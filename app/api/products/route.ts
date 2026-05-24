// app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      stocks: p.stocks.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseLocation: s.warehouse.location,
        total: s.total,
        reserved: s.reserved,
        available: s.total - s.reserved,
      })),
    }));

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
