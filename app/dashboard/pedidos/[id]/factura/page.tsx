"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { STATUS, TEMPLATES } from "@/lib/constants";
import { money } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
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

  const t = TEMPLATES.find((x) => x.id === profile.template) || TEMPLATES[0];
  const total = (Number(order.unit_price) || 0) * (Number(order.quantity) || 0);
  const deposit = Number(order.deposit) || 0;
  const balance = total - deposit;
  const st = STATUS[order.status];
  const today = new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });
  const isFiscal = order.invoice_mode === "fiscal";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => router.push("/dashboard/pedidos")} className="text-sm font-medium" style={{ color: "#1B2A4A" }}>← Volver</button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: "#1B2A4A", color: "#fff" }}>
          <Printer size={14} /> Descargar / Imprimir
        </button>
      </div>

      <div style={{ background: t.body, border: "1px solid #E4D8C6", borderRadius: 16, overflow: "hidden" }} className="shadow-sm">
        <div style={{ background: t.header, color: t.text }} className="px-6 py-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {profile.logo_url && (
              <div
                className="shrink-0 overflow-hidden"
                style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.logo_url} alt={profile.business_name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <div style={{ fontFamily: "var(--font-fraunces)" }} className="text-xl font-semibold">{profile.business_name}</div>
              <div className="text-xs opacity-90 mt-0.5">{profile.tagline}</div>
              {isFiscal && profile.rnc && <div className="text-[11px] opacity-90 mt-1">RNC: {profile.rnc}</div>}
            </div>
          </div>
          <div className="text-right text-[11px] opacity-90 leading-relaxed shrink-0">
            {profile.phone && <div>{profile.phone}</div>}
            {profile.instagram && <div>{profile.instagram}</div>}
            {profile.address && <div>{profile.address}</div>}
          </div>
        </div>

        <div className="px-6 py-5">
          {isFiscal && (
            <div className="flex items-center justify-between text-[11px] mb-3 px-2.5 py-1.5 rounded-lg" style={{ background: "#EFE3D2", color: "#101B33" }}>
              <span className="font-semibold">COMPROBANTE FISCAL</span>
              <span>NCF: {order.ncf || "—"}</span>
            </div>
          )}

          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9A8B85" }}>Factura para</div>
              <div className="font-semibold" style={{ color: "#101B33" }}>{order.client_name}</div>
              {order.client_phone && <div className="text-xs" style={{ color: "#8A7A75" }}>{order.client_phone}</div>}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold px-2.5 py-1 rounded-full inline-block" style={{ background: st.bg, color: st.color, transform: "rotate(3deg)" }}>
                {st.label.toUpperCase()}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "#8A7A75" }}>Emitida: {today}</div>
              <div className="text-[11px]" style={{ color: "#8A7A75" }}>Entrega: {order.delivery_date}</div>
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #1B2A4A", borderBottom: "1px dashed #1B2A4A" }} className="py-3 my-2">
            <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: "#9A8B85" }}>
              <span>PRODUCTO</span>
              <span>SUBTOTAL</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "#332A24" }}>{order.product_name} <span style={{ color: "#9A8B85" }}>x{order.quantity}</span></span>
              <span style={{ fontFamily: "var(--font-plex-mono)" }}>{money(total)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="text-xs mt-3 p-2.5 rounded-lg" style={{ background: "#EFE3D2", color: "#101B33" }}>
              <strong>Notas:</strong> {order.notes}
            </div>
          )}

          <div style={{ fontFamily: "var(--font-plex-mono)" }} className="mt-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between"><span style={{ color: "#8A7A75" }}>Total</span><span>{money(total)}</span></div>
            {deposit > 0 && <div className="flex items-center justify-between"><span style={{ color: "#8A7A75" }}>Abono recibido</span><span>-{money(deposit)}</span></div>}
            <div className="flex items-center justify-between text-base font-bold pt-1.5" style={{ borderTop: "1px solid #E4D8C6", color: "#101B33" }}>
              <span>Balance pendiente</span><span>{money(balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
