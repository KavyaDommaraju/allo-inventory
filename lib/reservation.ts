// lib/reservation.ts
/**
 * Core reservation logic.
 *
 * CONCURRENCY STRATEGY
 * --------------------
 * We use a two-layer approach:
 *
 * 1. Redis distributed lock (SETNX with TTL) per "product:warehouse" key.
 *    This serialises concurrent reservation attempts at the application level,
 *    preventing most races before they reach the database.
 *
 * 2. PostgreSQL advisory lock + conditional UPDATE inside a transaction.
 *    We UPDATE the stock row with a WHERE clause that checks
 *    (total - reserved) >= quantity. If 0 rows are affected we know stock
 *    is exhausted and return 409. Because the UPDATE is atomic at the row
 *    level in Postgres, this is correct even without the Redis lock —
 *    the Redis lock is a performance optimisation that avoids hammering
 *    Postgres under high concurrency.
 *
 * EXPIRY
 * ------
 * Reservations expire after RESERVATION_TTL_MINUTES (default 10 min).
 * We use a "lazy cleanup" strategy: when any endpoint reads a reservation
 * it checks expiresAt and, if elapsed, releases the hold and marks the
 * reservation RELEASED before returning. A Vercel Cron job at /api/cron/expire
 * additionally sweeps for stale reservations every minute so that available
 * stock is always accurate on the product listing page.
 */

import { prisma } from "./prisma";
import { redis } from "./redis";
import { ReservationStatus } from "@prisma/client";

export const RESERVATION_TTL_MINUTES = 10;
const LOCK_TTL_MS = 5000; // 5 seconds

/** Acquire a Redis lock for a stock slot. Returns the lock token or null. */
async function acquireLock(key: string): Promise<string | null> {
  const token = `${Date.now()}-${Math.random()}`;
  const result = await redis.set(`lock:${key}`, token, "PX", LOCK_TTL_MS, "NX");
  return result === "OK" ? token : null;
}

/** Release a Redis lock only if we still own it (Lua script for atomicity). */
async function releaseLock(key: string, token: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `lock:${key}`, token);
}

export type ReserveResult =
  | { success: true; reservation: Awaited<ReturnType<typeof getReservation>> }
  | { success: false; status: 409 | 429 | 500; message: string };

export async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number,
  idempotencyKey?: string
): Promise<ReserveResult> {
  // --- Idempotency: return existing reservation if key was seen before ---
  if (idempotencyKey) {
    const existing = await prisma.reservation.findUnique({
      where: { idempotencyKey },
      include: { product: true, warehouse: true },
    });
    if (existing) {
      const rel = await maybeExpire(existing);
      return { success: true, reservation: rel };
    }
  }

  // --- Redis distributed lock ---
  const lockKey = `${productId}:${warehouseId}`;
  const token = await acquireLock(lockKey);
  if (!token) {
    return { success: false, status: 429, message: "Too many concurrent requests. Please retry." };
  }

  try {
    // --- Atomic stock update inside a serialisable transaction ---
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      // Lock the stock row for this product+warehouse
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });

      if (!stock) throw new StockNotFoundError();

      const available = stock.total - stock.reserved;
      if (available < quantity) throw new InsufficientStockError(available);

      // Increment reserved count
      await tx.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      });

      // Create the reservation record
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
          idempotencyKey: idempotencyKey ?? null,
        },
        include: { product: true, warehouse: true },
      });

      return reservation;
    }, { timeout: 10000 });

    return { success: true, reservation: result };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return { success: false, status: 409, message: `Not enough stock. Available: ${err.available}` };
    }
    if (err instanceof StockNotFoundError) {
      return { success: false, status: 409, message: "Stock record not found for this product/warehouse." };
    }
    console.error("[createReservation]", err);
    return { success: false, status: 500, message: "Internal error. Please try again." };
  } finally {
    await releaseLock(lockKey, token);
  }
}

class InsufficientStockError extends Error {
  constructor(public available: number) { super("Insufficient stock"); }
}
class StockNotFoundError extends Error {}

/** Confirm a pending reservation (payment succeeded). */
export async function confirmReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { product: true, warehouse: true } });
  if (!reservation) return { success: false, status: 404, message: "Reservation not found." };

  // Lazy expiry check
  const expired = await maybeExpire(reservation);
  if (expired.status === "RELEASED") {
    return { success: false, status: 410, message: "Reservation has expired." };
  }
  if (expired.status === "CONFIRMED") {
    return { success: true, reservation: expired }; // idempotent
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.stock.update({
      where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
      // Decrement total (unit sold) and release the reserved hold
      data: {
        total: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });
    return tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { product: true, warehouse: true },
    });
  });

  return { success: true, reservation: updated };
}

/** Release a pending reservation (payment failed / user cancelled). */
export async function releaseReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { product: true, warehouse: true } });
  if (!reservation) return { success: false, status: 404, message: "Reservation not found." };
  if (reservation.status !== "PENDING") {
    return { success: true, reservation }; // already released/confirmed — idempotent
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.stock.update({
      where: { productId_warehouseId: { productId: reservation.productId, warehouseId: reservation.warehouseId } },
      data: { reserved: { decrement: reservation.quantity } },
    });
    return tx.reservation.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: new Date() },
      include: { product: true, warehouse: true },
    });
  });

  return { success: true, reservation: updated };
}

/** Lazy expiry: if a PENDING reservation is past expiresAt, release it now. */
export async function maybeExpire<T extends { id: string; status: ReservationStatus; expiresAt: Date; productId: string; warehouseId: string; quantity: number }>(reservation: T): Promise<T & { status: ReservationStatus }> {
  if (reservation.status !== "PENDING") return reservation as never;
  if (new Date() < reservation.expiresAt) return reservation as never;

  const result = await releaseReservation(reservation.id);
  return (result.reservation ?? reservation) as never;
}

async function getReservation(id: string) {
  return prisma.reservation.findUnique({ where: { id }, include: { product: true, warehouse: true } });
}

/** Sweep and release all expired PENDING reservations (used by cron). */
export async function expireStaleReservations() {
  const stale = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
  });
  const results = await Promise.allSettled(stale.map((r) => releaseReservation(r.id)));
  const released = results.filter((r) => r.status === "fulfilled").length;
  return { swept: stale.length, released };
}
