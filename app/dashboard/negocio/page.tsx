"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { TEMPLATES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Profile } from "@/lib/types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function NegocioPage() {
  const { profile, updateProfile } = useProfile();
  const { toast, notify } = useToast();
  const [form, setForm] = useState<Profile>(profile);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const save = async () => {
    const { error } = await updateProfile({
      business_name: form.business_name,
      tagline: form.tagline,
      owner_name: form.owner_name,
      phone: form.phone,
      email: form.email,
      instagram: form.instagram,
      address: form.address,
      template: form.template,
      rnc: form.rnc,
      invoice_mode: form.invoice_mode,
    });
    notify(error ? "No se pudo guardar" : "Datos del negocio actualizados");
  };

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("Sube una imagen (PNG, JPG...)");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      notify("La imagen no puede pesar más de 2MB");
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadError) {
      setUploadingLogo(false);
      notify("No se pudo subir el logo");
      return;
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const { error } = await updateProfile({ logo_url: data.publicUrl });
    setForm((prev) => ({ ...prev, logo_url: data.publicUrl }));
    setUploadingLogo(false);
    notify(error ? "No se pudo guardar el logo" : "Logo actualizado");
  };

  const removeLogo = async () => {
    const { error } = await updateProfile({ logo_url: "" });
    setForm((prev) => ({ ...prev, logo_url: "" }));
    notify(error ? "No se pudo quitar el logo" : "Logo eliminado");
  };

  return (
    <div className="space-y-4">
      <SectionTitle sub="Estos datos aparecen en todas tus facturas.">Mi Negocio</SectionTitle>

      <Card>
        <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Logo del negocio</span>
        <div className="flex items-center gap-4">
          <div
            className="shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 72, height: 72, borderRadius: "50%", background: "#EFE3D2", border: "1px solid #E4D8C6" }}
          >
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={22} color="#9A8B85" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
              style={{ background: "#1B2A4A", color: "#fff" }}
            >
              {uploadingLogo ? "Subiendo…" : form.logo_url ? "Cambiar logo" : "Subir logo"}
            </button>
            {form.logo_url && (
              <button onClick={removeLogo} className="text-xs font-medium flex items-center gap-1" style={{ color: "#B25C5C" }}>
                <X size={12} /> Quitar logo
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <Field label="Nombre del negocio">
            <input style={inputStyle} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </Field>
          <Field label="Eslogan / frase corta">
            <input style={inputStyle} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </Field>
          <Field label="Nombre del dueño/a">
            <input style={inputStyle} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Instagram / redes">
              <input style={inputStyle} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@negocio" />
            </Field>
          </div>
          <Field label="Correo (opcional)">
            <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Dirección (opcional)">
            <input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Facturación fiscal (RD)</span>
        <div className="space-y-3">
          <Field label="RNC del negocio">
            <input style={inputStyle} value={form.rnc} onChange={(e) => setForm({ ...form, rnc: e.target.value })} placeholder="000-00000-0" />
          </Field>
          <Field label="Modo de factura por defecto para pedidos nuevos">
            <select style={inputStyle} value={form.invoice_mode} onChange={(e) => setForm({ ...form, invoice_mode: e.target.value as Profile["invoice_mode"] })}>
              <option value="simple">Recibo simple</option>
              <option value="fiscal">Factura fiscal (RNC/NCF)</option>
            </select>
          </Field>
          <p className="text-[11px]" style={{ color: "#8A7A75" }}>
            El NCF de cada factura se escribe manualmente al crear el pedido, según tu propio talonario/secuencia
            autorizada por la DGII. No se genera ni se incrementa automáticamente.
          </p>
        </div>
      </Card>

      <Card>
        <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Diseño de factura</span>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setForm({ ...form, template: t.id })}
              className="rounded-lg overflow-hidden border-2 text-left"
              style={{ borderColor: form.template === t.id ? "#1B2A4A" : "#E4D8C6" }}
            >
              <div style={{ background: t.header, color: t.text }} className="px-2.5 py-2 text-[11px] font-semibold">{t.label}</div>
              <div style={{ background: t.body }} className="h-8" />
            </button>
          ))}
        </div>
      </Card>

      <PrimaryButton onClick={save} full>Guardar cambios</PrimaryButton>
      <Toast message={toast} />
    </div>
  );
}
