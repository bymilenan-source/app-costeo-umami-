"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, MessageCircle, Search } from "lucide-react";
import { money } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { deriveClients, matchClients, whatsappLink, type ClientSummary } from "@/lib/clients";
import { Card, SectionTitle, inputStyle } from "@/components/ui";
import type { Order } from "@/lib/types";

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const clients = useMemo(() => deriveClients(orders), [orders]);
  const shown = query.trim() ? matchClients(clients, query, 100) : clients;

  const newOrderFor = (c: ClientSummary, repeat: boolean) => {
    const p = new URLSearchParams({ nuevo: "1", cliente: c.name, tel: c.phone });
    if (repeat) p.set("repetir", c.lastOrder.id);
    router.push(`/dashboard/pedidos?${p.toString()}`);
  };

  if (loading) return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;

  return (
    <div className="space-y-4">
      <SectionTitle sub="Se guardan solos: cada cliente al que le haces un pedido aparece aquí.">Clientes</SectionTitle>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#B0A29C" }} />
        <input
          style={{ ...inputStyle, paddingLeft: 34 }}
          placeholder="Buscar por nombre o teléfono"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {clients.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>
            Aún no tienes clientes. Aparecerán aquí cuando registres tu primer pedido.
          </p>
        )}
        {clients.length > 0 && shown.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>Ningún cliente coincide con “{query}”.</p>
        )}
        {shown.map((c) => (
          <Card key={c.key}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm" style={{ color: "#101B33" }}>{c.name}</div>
                {c.phone && <div className="text-xs" style={{ color: "#8A7A75" }}>{c.phone}</div>}
                <div className="text-xs mt-1" style={{ color: "#8A7A75" }}>
                  {c.orderCount} {c.orderCount === 1 ? "pedido" : "pedidos"} · {money(c.totalSpent)}
                </div>
                <div className="text-xs" style={{ color: "#8A7A75" }}>
                  Último: {c.lastOrder.product_name}{c.lastOrder.delivery_date ? ` (${c.lastOrder.delivery_date})` : ""}
                </div>
                {c.balance > 0 && (
                  <div className="text-xs font-semibold mt-1" style={{ color: "#B25C5C" }}>Debe {money(c.balance)}</div>
                )}
              </div>
              {c.phone && (
                <a href={whatsappLink(c.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="shrink-0 p-1" style={{ color: "#4E7A50" }}>
                  <MessageCircle size={18} />
                </a>
              )}
            </div>
            <div className="flex gap-2 mt-3 pt-2" style={{ borderTop: "1px solid #E4D8C6" }}>
              <button
                onClick={() => newOrderFor(c, false)}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg"
                style={{ background: "#1B2A4A", color: "#fff" }}
              >
                <Plus size={13} /> Nuevo pedido
              </button>
              <button
                onClick={() => newOrderFor(c, true)}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-lg border"
                style={{ borderColor: "#1B2A4A", color: "#1B2A4A" }}
              >
                <RotateCcw size={13} /> Repetir último
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
