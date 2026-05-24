// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi Central", location: "New Delhi, DL" },
  });
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai West", location: "Mumbai, MH" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore South", location: "Bangalore, KA" },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Testosterone Booster Pro",
        description:
          "Clinically formulated supplement to support healthy testosterone levels naturally.",
        imageUrl: "https://placehold.co/400x300/1a1a2e/white?text=T-Booster+Pro",
      },
    }),
    prisma.product.create({
      data: {
        name: "Sildenafil 50mg (Strip of 4)",
        description:
          "FDA-approved medication for erectile dysfunction. Prescription included.",
        imageUrl: "https://placehold.co/400x300/16213e/white?text=Sildenafil+50mg",
      },
    }),
    prisma.product.create({
      data: {
        name: "Men's Wellness Kit",
        description:
          "Complete kit including vitamins, supplements and a confidential health assessment.",
        imageUrl: "https://placehold.co/400x300/0f3460/white?text=Wellness+Kit",
      },
    }),
    prisma.product.create({
      data: {
        name: "Tadalafil 10mg (Strip of 4)",
        description:
          "Long-acting treatment for ED with up to 36 hours effectiveness.",
        imageUrl: "https://placehold.co/400x300/533483/white?text=Tadalafil+10mg",
      },
    }),
    prisma.product.create({
      data: {
        name: "Hair Growth Serum",
        description:
          "Clinically proven formula to combat hair loss and promote regrowth.",
        imageUrl: "https://placehold.co/400x300/2b2d42/white?text=Hair+Serum",
      },
    }),
  ]);

  // Seed stock (some deliberately low to demo race-condition scenario)
  const stockData = [
    // Testosterone Booster
    { productId: products[0].id, warehouseId: delhi.id, total: 50, reserved: 0 },
    { productId: products[0].id, warehouseId: mumbai.id, total: 30, reserved: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, total: 20, reserved: 0 },
    // Sildenafil — intentionally scarce
    { productId: products[1].id, warehouseId: delhi.id, total: 3, reserved: 0 },
    { productId: products[1].id, warehouseId: mumbai.id, total: 5, reserved: 0 },
    { productId: products[1].id, warehouseId: bangalore.id, total: 1, reserved: 0 },
    // Wellness Kit
    { productId: products[2].id, warehouseId: delhi.id, total: 15, reserved: 0 },
    { productId: products[2].id, warehouseId: mumbai.id, total: 10, reserved: 0 },
    // Tadalafil
    { productId: products[3].id, warehouseId: delhi.id, total: 8, reserved: 0 },
    { productId: products[3].id, warehouseId: bangalore.id, total: 4, reserved: 0 },
    // Hair Serum
    { productId: products[4].id, warehouseId: mumbai.id, total: 25, reserved: 0 },
    { productId: products[4].id, warehouseId: bangalore.id, total: 12, reserved: 0 },
  ];

  for (const s of stockData) {
    await prisma.stock.create({ data: s });
  }

  console.log(
    `✅ Seeded ${products.length} products, 3 warehouses, ${stockData.length} stock entries`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
