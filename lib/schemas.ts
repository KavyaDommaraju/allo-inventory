// lib/schemas.ts
import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).max(100),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string(),
  confirmedAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
  createdAt: z.string(),
  product: z.object({ id: z.string(), name: z.string() }).optional(),
  warehouse: z.object({ id: z.string(), name: z.string(), location: z.string() }).optional(),
});

export type Reservation = z.infer<typeof ReservationSchema>;
