"use client";

import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/profile-context";
import { InvoiceCard, type InvoiceOrderData } from "@/components/dashboard/InvoiceCard";

const SAMPLE_ORDER: InvoiceOrderData = {
  client_name: "Cliente de ejemplo",
  client_phone: "809-000-0000",
  product_name: "Producto de ejemplo",
  quantity: 1,
  unit_price: 1500,
  delivery_date: new Date().toISOString().slice(0, 10),
  notes: "Esto es una vista previa con datos de ejemplo, así se vería tu factura real.",
  deposit: 500,
  status: "abonado",
  invoice_mode: "fiscal",
  ncf: "B0100000123",
};

export default function VistaPreviaPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const sample = { ...SAMPLE_ORDER, invoice_mode: profile.invoice_mode };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/dashboard/negocio")} className="text-sm font-medium" style={{ color: "#1B2A4A" }}>← Volver</button>
        <span className="text-xs font-medium" style={{ color: "#8A7A75" }}>Vista previa con datos de ejemplo</span>
      </div>
      <InvoiceCard profile={profile} order={sample} />
    </div>
  );
}
