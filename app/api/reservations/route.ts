// app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createReservation } from "@/lib/reservation";
import { CreateReservationSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;

    const result = await createReservation(productId, warehouseId, quantity, idempotencyKey);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.reservation, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
