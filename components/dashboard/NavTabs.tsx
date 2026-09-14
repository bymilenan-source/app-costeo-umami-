"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ChefHat, Receipt, Package, Boxes, Store } from "lucide-react";
import { COLORS } from "@/lib/constants";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/recetas", label: "Costos y Precios", icon: ChefHat },
  { href: "/dashboard/pedidos", label: "Pedidos y Facturas", icon: Receipt },
  { href: "/dashboard/ingredientes", label: "Ingredientes", icon: Package },
  { href: "/dashboard/insumos", label: "Insumos", icon: Boxes },
  { href: "/dashboard/negocio", label: "Mi Negocio", icon: Store },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="max-w-3xl mx-auto px-3 -mt-1 sticky top-[76px] z-20 print:hidden">
      <div
        style={{ background: COLORS.creamCard, borderColor: COLORS.line }}
        className="flex rounded-xl border overflow-x-auto shadow-sm"
      >
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex-1 min-w-[64px] flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
              style={{
                background: active ? COLORS.blush : "transparent",
                color: active ? COLORS.plumDark : "#9A8B85",
                borderBottom: active ? `2px solid ${COLORS.plum}` : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
