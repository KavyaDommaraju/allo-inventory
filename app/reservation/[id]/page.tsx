// app/reservation/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { maybeExpire } from "@/lib/reservation";
import { notFound } from "next/navigation";
import ReservationClient from "./ReservationClient";

export const dynamic = "force-dynamic";

export default async function ReservationPage({ params }: { params: { id: string } }) {
  const raw = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { product: true, warehouse: true },
  });

  if (!raw) notFound();

  const reservation = await maybeExpire(raw);

  // Serialise for client
  const serialised = {
    ...reservation,
    expiresAt: reservation.expiresAt.toISOString(),
    confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
    releasedAt: reservation.releasedAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
    product: {
      id: reservation.product.id,
      name: reservation.product.name,
    },
    warehouse: {
      id: reservation.warehouse.id,
      name: reservation.warehouse.name,
      location: reservation.warehouse.location,
    },
  };

  return <ReservationClient initialReservation={serialised} />;
}
