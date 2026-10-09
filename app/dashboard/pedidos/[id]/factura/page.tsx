"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Printer, Eye, Share2, X, Camera, Trash2 } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, notify } = useToast();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", params.id).single();
      setOrder((data as Order) ?? null);
    })();
  }, [supabase, params.id]);

  // Foto del trabajo: se guarda en el bucket público "logos" (ya existente, con
  // políticas por carpeta de usuaria) en <uid>/pedidos/<id del pedido>.jpg.
  // Así no hace falta una migración nueva de base de datos.
  const photoPath = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    return uid ? { folder: `${uid}/pedidos`, path: `${uid}/pedidos/${params.id}.jpg` } : null;
  };

  useEffect(() => {
    (async () => {
      const p = await photoPath();
      if (!p) return;
      const { data } = await supabase.storage.from("logos").list(p.folder, { search: `${params.id}.jpg` });
      const found = data?.find((f) => f.name === `${params.id}.jpg`);
      if (found) {
        const { data: pub } = supabase.storage.from("logos").getPublicUrl(p.path);
        setPhotoUrl(`${pub.publicUrl}?v=${encodeURIComponent(found.updated_at ?? "")}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, params.id]);

  // Reduce la foto (máx. 1200 px, JPEG) para que suba rápido con datos móviles.
  const shrink = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la foto")); };
      img.src = url;
    });

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const p = await photoPath();
      if (!p) { notify("Vuelve a iniciar sesión"); return; }
      const blob = await shrink(file);
      const { error } = await supabase.storage.from("logos").upload(p.path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) { notify(`No se pudo subir la foto: ${error.message}`); return; }
      const { data: pub } = supabase.storage.from("logos").getPublicUrl(p.path);
      setPhotoUrl(`${pub.publicUrl}?v=${Date.now()}`);
      notify("Foto agregada a la factura");
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    const p = await photoPath();
    if (!p) return;
    const { error } = await supabase.storage.from("logos").remove([p.path]);
    if (error) { notify("No se pudo quitar la foto"); return; }
    setPhotoUrl(null);
  };

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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border disabled:opacity-50"
            style={{ borderColor: "#1B2A4A", color: "#1B2A4A" }}
          >
            <Camera size={14} /> {uploadingPhoto ? "Subiendo…" : photoUrl ? "Cambiar foto" : "Agregar foto"}
          </button>
          {photoUrl && (
            <button onClick={removePhoto} aria-label="Quitar foto" className="px-2 py-2" style={{ color: "#B25C5C" }}>
              <Trash2 size={16} />
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: "#1B2A4A", color: "#fff" }}>
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>
      <div ref={invoiceRef}>
        <InvoiceCard profile={profile} order={order} photoUrl={photoUrl} />
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
