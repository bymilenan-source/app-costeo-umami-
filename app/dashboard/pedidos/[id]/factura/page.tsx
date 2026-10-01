"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Printer, Eye, Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/lib/useToast";
import { Toast } from "@/components/ui";
import { InvoiceCard } from "@/components/dashboard/InvoiceCard";
import type { Order } from "@/lib/types";

export default function FacturaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { toast, notify } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", params.id).single();
      setOrder((data as Order) ?? null);
    })();
  }, [supabase, params.id]);

  const openPreview = async () => {
    if (!invoiceRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoiceRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
      setPreviewCanvas(canvas);
    } catch {
      notify("No se pudo generar la vista previa");
    } finally {
      setGenerating(false);
    }
  };

  const shareCanvas = async () => {
    if (!previewCanvas || !order) return;
    setSharing(true);
    try {
      const blob: Blob | null = await new Promise((resolve) => previewCanvas.toBlob(resolve, "image/png"));
      if (!blob) {
        notify("No se pudo generar la imagen");
        return;
      }
      const fileName = `factura-${order.client_name}.png`.replace(/\s+/g, "-").toLowerCase();
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Factura", text: `Factura para ${order.client_name}` });
        setPreviewCanvas(null);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        notify("Imagen descargada. Compártela desde tu galería.");
        setPreviewCanvas(null);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        notify("No se pudo compartir la factura");
      }
    } finally {
      setSharing(false);
    }
  };

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
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <button onClick={() => router.push("/dashboard/pedidos")} className="text-sm font-medium" style={{ color: "#1B2A4A" }}>← Volver</button>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push(`/dashboard/pedidos?edit=${order.id}`)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border"
            style={{ borderColor: "#1B2A4A", color: "#1B2A4A" }}
          >
            <Pencil size={14} /> Editar
          </button>
          <button
            onClick={openPreview}
            disabled={generating}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border disabled:opacity-50"
            style={{ borderColor: "#1B2A4A", color: "#1B2A4A" }}
          >
            <Eye size={14} /> {generating ? "Generando…" : "Vista previa"}
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: "#1B2A4A", color: "#fff" }}>
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>
      <div ref={invoiceRef}>
        <InvoiceCard profile={profile} order={order} />
      </div>

      {previewCanvas && (
        <div className="fixed inset-0 z-50 flex flex-col print:hidden" style={{ background: "rgba(16,27,51,0.92)" }}>
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>Así le llegará al cliente</span>
            <button onClick={() => setPreviewCanvas(null)} style={{ color: "#fff" }}><X size={22} /></button>
          </div>
          <div className="flex-1 overflow-auto px-4 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewCanvas.toDataURL("image/png")} alt="Vista previa de la factura" className="w-full rounded-lg" />
          </div>
          <div className="p-4 shrink-0">
            <button
              onClick={shareCanvas}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-lg disabled:opacity-50"
              style={{ background: "#1B2A4A", color: "#fff" }}
            >
              <Share2 size={16} /> {sharing ? "Compartiendo…" : "Compartir con el cliente"}
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
