// app/page.tsx
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

async function getProducts() {
  return prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <p className="mt-2 text-gray-500">
          Browse available inventory across all warehouses. Stock is held for{" "}
          <span className="font-medium text-indigo-600">10 minutes</span> while you complete
          checkout.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No products found. Run <code className="bg-gray-100 px-1 rounded">npm run db:seed</code> to populate the database.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
