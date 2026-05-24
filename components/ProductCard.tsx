"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stock = {
  warehouseId: string;
  warehouse: { name: string; location: string };
  total: number;
  reserved: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  stocks: Stock[];
};

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    product.stocks[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
  const available = selectedStock ? selectedStock.total - selectedStock.reserved : 0;

  async function handleReserve() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to reserve. Please try again.");
        return;
      }

      router.push(`/reservation/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const totalAvailable = product.stocks.reduce(
    (sum, s) => sum + Math.max(0, s.total - s.reserved),
    0
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-fade-in hover:shadow-md transition-shadow">
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-44 object-cover bg-gray-100"
        />
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900 text-lg leading-snug">{product.name}</h2>
          {product.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{product.description}</p>
          )}

          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                totalAvailable > 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${totalAvailable > 0 ? "bg-green-500" : "bg-red-500"}`} />
              {totalAvailable > 0 ? `${totalAvailable} units available` : "Out of stock"}
            </span>
          </div>
        </div>

        {product.stocks.length > 0 && totalAvailable > 0 && (
          <div className="mt-4 space-y-3">
            {/* Warehouse selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Warehouse</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  setQuantity(1);
                  setError(null);
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {product.stocks.map((s) => {
                  const avail = s.total - s.reserved;
                  return (
                    <option key={s.warehouseId} value={s.warehouseId} disabled={avail <= 0}>
                      {s.warehouse.name} — {avail > 0 ? `${avail} avail.` : "out of stock"}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quantity selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg leading-none"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg leading-none"
                >
                  +
                </button>
                <span className="ml-auto text-xs text-gray-400">max {available}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleReserve}
              disabled={loading || available <= 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {loading ? "Reserving…" : "Reserve →"}
            </button>
          </div>
        )}

        {totalAvailable === 0 && (
          <div className="mt-4 text-center text-sm text-gray-400 py-2">
            Check back soon
          </div>
        )}
      </div>
    </div>
  );
}
