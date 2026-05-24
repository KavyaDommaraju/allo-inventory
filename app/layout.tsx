// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Health — Inventory",
  description: "Inventory and order-fulfillment platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-700">
              <svg viewBox="0 0 32 32" className="w-7 h-7 fill-indigo-600" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" />
                <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fill="white" fontWeight="bold">A</text>
              </svg>
              Allo Health
            </a>
            <span className="text-gray-300">|</span>
            <a href="/" className="text-sm text-gray-600 hover:text-indigo-600 transition-colors">Products</a>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white py-6 text-center text-sm text-gray-400">
          Allo Health Inventory Platform · Built for the take-home exercise
        </footer>
      </body>
    </html>
  );
}
