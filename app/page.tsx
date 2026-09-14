"use client";

import { useState } from "react";
import { ChefHat, Receipt, LayoutDashboard, Package, Check } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { Card, PrimaryButton, Field, inputStyle } from "@/components/ui";
import { useToast } from "@/lib/useToast";

const FEATURES = [
  {
    icon: ChefHat,
    title: "Costos y precios reales",
    text: "Registra ingredientes e insumos, arma tus recetas (incluso con sub-recetas) y obtén el precio de venta sugerido al instante.",
  },
  {
    icon: Receipt,
    title: "Pedidos y facturas",
    text: "Lleva el control de cada pedido, su estado de pago, y genera una factura lista para imprimir o enviar — con o sin comprobante fiscal.",
  },
  {
    icon: LayoutDashboard,
    title: "Resumen del negocio",
    text: "Facturación, gastos fijos, ganancia neta y meta de pedidos del mes, todo en un solo vistazo.",
  },
  {
    icon: Package,
    title: "Ingredientes e insumos por separado",
    text: "El costo de tu comida y el de tu empaque, siempre desglosados aparte para que sepas exactamente en qué se va cada peso.",
  },
];

export default function LandingPage() {
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast, notify } = useToast();

  const submit = async () => {
    if (!form.name || !form.contact) {
      notify("Ponle tu nombre y un contacto (teléfono, Instagram o correo)");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("subscription_requests").insert({
      name: form.name,
      contact: form.contact,
      message: form.message,
    });
    setSubmitting(false);
    if (error) {
      notify("No se pudo enviar, intenta de nuevo");
      return;
    }
    setSent(true);
  };

  return (
    <div style={{ background: COLORS.cream, minHeight: "100vh" }}>
      <header style={{ background: COLORS.plum }} className="px-5 pt-10 pb-14">
        <div className="max-w-3xl mx-auto text-center">
          <div style={{ fontFamily: "var(--font-fraunces)", color: "#fff" }} className="text-3xl md:text-4xl font-semibold tracking-tight">
            Costeo UMAMI
          </div>
          <p style={{ color: COLORS.blush }} className="text-sm md:text-base mt-3 max-w-xl mx-auto">
            La herramienta diaria para pasteleras y pequeños emprendimientos de comida:
            costea tus recetas, arma tus pedidos y factura sin dolores de cabeza.
          </p>
          <div className="mt-6">
            <a
              href="#suscribirme"
              className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold"
              style={{ background: COLORS.butter, color: COLORS.plumDark }}
            >
              Quiero probarla
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-8 pb-16 space-y-8">
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 rounded-lg p-2"
                    style={{ background: COLORS.blush, color: COLORS.plumDark }}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: COLORS.plumDark }}>{f.title}</div>
                    <p className="text-xs mt-1" style={{ color: "#8A7A75" }}>{f.text}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card id="suscribirme" style={{ scrollMarginTop: 20 }}>
          {sent ? (
            <div className="text-center py-6">
              <div
                className="mx-auto mb-3 flex items-center justify-center rounded-full"
                style={{ width: 40, height: 40, background: COLORS.sageBg, color: COLORS.sage }}
              >
                <Check size={20} />
              </div>
              <div className="font-semibold" style={{ color: COLORS.plumDark, fontFamily: "var(--font-fraunces)" }}>
                ¡Recibido!
              </div>
              <p className="text-sm mt-1" style={{ color: "#8A7A75" }}>
                Nos pondremos en contacto contigo para activar tu suscripción.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div style={{ fontFamily: "var(--font-fraunces)", color: COLORS.plumDark }} className="text-lg font-semibold">
                  Solicita tu acceso
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>
                  Déjanos tus datos y te contactamos para activar tu cuenta.
                </p>
              </div>
              <div className="space-y-3">
                <Field label="Tu nombre">
                  <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre y apellido" />
                </Field>
                <Field label="Teléfono, Instagram o correo">
                  <input style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="809-000-0000 / @tunegocio" />
                </Field>
                <Field label="Cuéntanos sobre tu negocio (opcional)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 70 }}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Ej. Hago postres por encargo en Santo Domingo Este"
                  />
                </Field>
                <PrimaryButton onClick={submit} full disabled={submitting}>
                  {submitting ? "Enviando…" : "Enviar solicitud"}
                </PrimaryButton>
              </div>
            </>
          )}
        </Card>

        <div className="text-center">
          <a href="/login" className="text-xs font-medium" style={{ color: COLORS.plum }}>
            ¿Ya tienes cuenta? Inicia sesión
          </a>
        </div>
      </main>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg z-50"
          style={{ background: COLORS.charcoal, color: COLORS.butter }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
