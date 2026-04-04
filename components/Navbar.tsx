"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <Link
            href="/"
            className="text-lg sm:text-xl font-bold text-slate-100 shrink-0"
          >
            Route Boss
          </Link>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-4 justify-start sm:justify-end min-w-0">
            <Link
              href="/import"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded text-sm transition-colors ${
                isActive("/import")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Import
            </Link>
            <Link
              href="/customers"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded text-sm transition-colors ${
                isActive("/customers")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Customers
            </Link>
            <Link
              href="/routes"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded text-sm transition-colors ${
                isActive("/routes")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Routes
            </Link>
            <Link
              href="/map"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded text-sm transition-colors ${
                isActive("/map")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Map
            </Link>
            <Link
              href="/gear"
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded text-sm transition-colors ${
                pathname?.startsWith("/gear")
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }`}
            >
              Gear Garage
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

