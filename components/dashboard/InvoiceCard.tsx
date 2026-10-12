"use client";

import { useEffect, useState } from "react";
import { STATUS, TEMPLATES } from "@/lib/constants";
import { money } from "@/lib/costing";
import type { Profile, InvoiceMode, OrderStatus } from "@/lib/types";

export interface InvoiceOrderData {
  client_name: string;
  client_phone: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  delivery_date: string | null;
  notes: string;
  deposit: number;
  status: OrderStatus;
  invoice_mode: InvoiceMode;
  ncf: string;
}

// La imagen que se comparte se genera con html2canvas, que no respeta
// `object-fit: cover`: estiraba el logo dentro del círculo y mostraba las
// partes que el recorte ocultaba (p. ej. bordes negros). Recortamos el logo a
// un cuadrado centrado en un canvas para que se vea igual en la app y en la
// imagen que recibe el cliente.
function useSquareImage(url: string | undefined | null, size = 192) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        c.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        setSrc(c.toDataURL("image/png"));
      } catch {
        setSrc(url);
      }
    };
    img.onerror = () => { if (!cancelled) setSrc(url); };
    img.src = url;
    return () => { cancelled = true; };
  }, [url, size]);
  return src;
}

export function InvoiceCard({ profile, order, photoUrl }: { profile: Profile; order: InvoiceOrderData; photoUrl?: string | null }) {
  const t = TEMPLATES.find((x) => x.id === profile.template) || TEMPLATES[0];
  const total = (Number(order.unit_price) || 0) * (Number(order.quantity) || 0);
  const deposit = Number(order.deposit) || 0;
  const balance = total - deposit;
  const st = STATUS[order.status];
  const today = new Date().toLocaleDateString("es-DO", { year: "numeric", month: "long", day: "numeric" });
  const isFiscal = order.invoice_mode === "fiscal";
  const logoSrc = useSquareImage(profile.logo_url);

  return (
    <div style={{ background: t.body, border: "1px solid #E4D8C6", borderRadius: 16, overflow: "hidden" }} className="shadow-sm">
      <div style={{ background: t.header, color: t.text }} className="px-6 py-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {profile.logo_url && (
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoSrc && <img src={logoSrc} alt={profile.business_name} width={48} height={48} style={{ width: 48, height: 48, display: "block" }} />}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--font-fraunces)" }} className="text-xl font-semibold">{profile.business_name}</div>
            <div className="text-xs opacity-90 mt-0.5">{profile.tagline}</div>
            {isFiscal && profile.rnc && <div className="text-[11px] opacity-90 mt-1">RNC: {profile.rnc}</div>}
          </div>
        </div>
        <div className="text-right text-[11px] opacity-90 leading-relaxed min-w-0" style={{ maxWidth: "45%", overflowWrap: "anywhere" }}>
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
          <div className="flex flex-col items-end gap-1">
            <div
              className="text-[10px] font-bold px-2.5 rounded-full"
              style={{ background: st.bg, color: st.color, height: 22, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: 3 }}
            >
              {st.label.toUpperCase()}
            </div>
            <div className="text-[11px] text-right" style={{ color: "#8A7A75" }}>Emitida: {today}</div>
            <div className="text-[11px] text-right" style={{ color: "#8A7A75" }}>Entrega: {order.delivery_date}</div>
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

        {photoUrl && (
          <div className="mt-3 rounded-lg overflow-hidden" style={{ border: "1px solid #E4D8C6" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={order.product_name} crossOrigin="anonymous" className="w-full h-auto block" />
          </div>
        )}

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
  );
}
