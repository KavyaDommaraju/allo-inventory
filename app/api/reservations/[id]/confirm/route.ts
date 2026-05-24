// app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { confirmReservation } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await confirmReservation(params.id);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.reservation);
  } catch (err) {
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
