"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ReservationData = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  product: { id: string; name: string };
  warehouse: { id: string; name: string; location: string };
};

function useCountdown(expiresAt: string, active: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(interval);
  }, [expiresAt, active]);

  return secondsLeft;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StatusBadge({ status }: { status: ReservationData["status"] }) {
  const config = {
    PENDING: { label: "Pending", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    CONFIRMED: { label: "Confirmed", cls: "bg-green-50 text-green-700 border-green-200" },
    RELEASED: { label: "Released", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  }[status];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.cls}`}>
      {config.label}
    </span>
  );
}

export default function ReservationClient({
  initialReservation,
}: {
  initialReservation: ReservationData;
}) {
  const [reservation, setReservation] = useState<ReservationData>(initialReservation);
  const [actionLoading, setActionLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = reservation.status === "PENDING";
  const secondsLeft = useCountdown(reservation.expiresAt, isPending);

  // Poll for server-side expiry while reservation is PENDING
  useEffect(() => {
    if (!isPending) return;
    if (secondsLeft <= 0) {
      // Grace: fetch updated state from server
      fetch(`/api/reservations/${reservation.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status) setReservation(serializeDates(data));
        })
        .catch(() => {});
    }
  }, [secondsLeft, isPending, reservation.id]);

  function serializeDates(r: ReservationData): ReservationData {
    return {
      ...r,
      expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : new Date(r.expiresAt).toISOString(),
      confirmedAt: r.confirmedAt ? (typeof r.confirmedAt === "string" ? r.confirmedAt : new Date(r.confirmedAt).toISOString()) : null,
      releasedAt: r.releasedAt ? (typeof r.releasedAt === "string" ? r.releasedAt : new Date(r.releasedAt).toISOString()) : null,
    };
  }

  const handleAction = useCallback(
    async (action: "confirm" | "release") => {
      setError(null);
      setActionLoading(action === "confirm" ? "confirm" : "cancel");
      try {
        const res = await fetch(`/api/reservations/${reservation.id}/${action}`, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 410) {
            setError("This reservation has expired. The stock has been released back.");
            const refreshed = await fetch(`/api/reservations/${reservation.id}`).then((r) => r.json());
            setReservation(serializeDates(refreshed));
            return;
          }
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        setReservation(serializeDates(data));
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setActionLoading(null);
      }
    },
    [reservation.id]
  );

  const urgent = isPending && secondsLeft < 60;
  const expired = isPending && secondsLeft === 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-12 animate-fade-in">
      <Link href="/" className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
        ← Back to products
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-indigo-200 text-sm font-medium uppercase tracking-wide">Reservation</p>
              <h1 className="text-xl font-bold mt-0.5">{reservation.product.name}</h1>
            </div>
            <StatusBadge status={reservation.status} />
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Warehouse</dt>
              <dd className="font-medium text-gray-900">{reservation.warehouse.name}</dd>
              <dd className="text-xs text-gray-400">{reservation.warehouse.location}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Quantity</dt>
              <dd className="font-medium text-gray-900">{reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Reservation ID</dt>
              <dd className="font-mono text-xs text-gray-600 truncate">{reservation.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Expires at</dt>
              <dd className="font-medium text-gray-900 text-xs">
                {new Date(reservation.expiresAt).toLocaleTimeString()}
              </dd>
            </div>
          </dl>

          {/* Countdown — only when PENDING */}
          {isPending && (
            <div
              className={`rounded-xl p-4 flex items-center gap-3 ${
                expired
                  ? "bg-red-50 border border-red-200"
                  : urgent
                  ? "bg-orange-50 border border-orange-200"
                  : "bg-indigo-50 border border-indigo-100"
              }`}
            >
              <div className={`text-3xl font-mono font-bold tabular-nums ${
                expired ? "text-red-600" : urgent ? "text-orange-600" : "text-indigo-600"
              }`}>
                {formatTime(secondsLeft)}
              </div>
              <div className="text-sm">
                {expired ? (
                  <p className="text-red-700 font-medium">Reservation expired — stock released.</p>
                ) : (
                  <>
                    <p className={`font-medium ${urgent ? "text-orange-700" : "text-indigo-700"}`}>
                      {urgent ? "Hurry! Time running out" : "Time remaining"}
                    </p>
                    <p className="text-gray-500">Complete your purchase before the hold expires</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Confirmed state */}
          {reservation.status === "CONFIRMED" && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4">
              <p className="font-semibold text-green-800">🎉 Purchase confirmed!</p>
              <p className="text-sm text-green-700 mt-1">
                Your order is being processed. Confirmed at{" "}
                {reservation.confirmedAt
                  ? new Date(reservation.confirmedAt).toLocaleTimeString()
                  : "—"}
              </p>
            </div>
          )}

          {/* Released state */}
          {reservation.status === "RELEASED" && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="font-semibold text-gray-700">Reservation released</p>
              <p className="text-sm text-gray-500 mt-1">
                The held stock has been returned to inventory.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action buttons */}
          {isPending && !expired && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleAction("confirm")}
                disabled={!!actionLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {actionLoading === "confirm" ? "Processing…" : "✓ Confirm purchase"}
              </button>
              <button
                onClick={() => handleAction("release")}
                disabled={!!actionLoading}
                className="flex-1 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-semibold py-3 rounded-xl border border-gray-200 transition-colors text-sm"
              >
                {actionLoading === "cancel" ? "Cancelling…" : "✕ Cancel"}
              </button>
            </div>
          )}

          {(reservation.status !== "PENDING" || expired) && (
            <Link
              href="/"
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Browse more products
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
