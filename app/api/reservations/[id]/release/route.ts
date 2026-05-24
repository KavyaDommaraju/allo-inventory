// app/api/reservations/[id]/release/route.ts
import { NextRequest, NextResponse } from "next/server";
import { releaseReservation } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await releaseReservation(params.id);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.reservation);
  } catch (err) {
    console.error("[POST /api/reservations/:id/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
