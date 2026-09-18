"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { InvoiceCard } from "@/components/dashboard/InvoiceCard";
import type { Order } from "@/lib/types";

export default function FacturaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", params.id).single();
      setOrder((data as Order) ?? null);
    })();
  }, [supabase, params.id]);

  if (order === undefined) {
    return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;
  }
  if (!order) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: "#B0A29C" }}>No se encontró el pedido.</p>
        <button onClick={() => router.push("/dashboard/pedidos")} className="mt-3 text-sm font-medium" style={{ color: "#1B2A4A" }}>Volver a pedidos</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => router.push("/dashboard/pedidos")} className="text-sm font-medium" style={{ color: "#1B2A4A" }}>← Volver</button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/pedidos?edit=${order.id}`)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border"
            style={{ borderColor: "#1B2A4A", color: "#1B2A4A" }}
          >
            <Pencil size={14} /> Editar
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: "#1B2A4A", color: "#fff" }}>
            <Printer size={14} /> Descargar / Imprimir
          </button>
        </div>
      </div>
      <InvoiceCard profile={profile} order={order} />
    </div>
  );
}
