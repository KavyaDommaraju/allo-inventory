// app/api/reservations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maybeExpire } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Lazy expiry — if past expiry, release and return updated record
    const updated = await maybeExpire(reservation);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[GET /api/reservations/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
