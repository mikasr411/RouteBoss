"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-slate-100">
            Route Boss
          </Link>
          <div className="flex gap-6">
            <Link
              href="/import"
              className={`px-3 py-2 rounded transition-colors ${
                isActive("/import")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Import
            </Link>
            <Link
              href="/customers"
              className={`px-3 py-2 rounded transition-colors ${
                isActive("/customers")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Customers
            </Link>
            <Link
              href="/routes"
              className={`px-3 py-2 rounded transition-colors ${
                isActive("/routes")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Routes
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

