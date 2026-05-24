// app/api/cron/expire/route.ts
/**
 * Vercel Cron Job — runs every minute.
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/expire", "schedule": "* * * * *" }] }
 *
 * Protected by CRON_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { expireStaleReservations } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await expireStaleReservations();
    console.log(`[cron/expire] Swept ${result.swept}, released ${result.released}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/expire]", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
