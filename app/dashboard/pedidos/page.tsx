"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Clock, AlertCircle, X } from "lucide-react";
import { STATUS, uid } from "@/lib/constants";
import { money } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Order, OrderStatus, Recipe } from "@/lib/types";

export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showForm, setShowForm] = useState(false);

  const blank = () => ({
    clientName: "", clientPhone: "", productName: "", recipeId: "",
    quantity: "1", unitPrice: "", deliveryDate: "", notes: "", deposit: "",
    invoiceMode: profile.invoice_mode, ncf: "",
  });
  const [form, setForm] = useState(blank());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: r }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("recipes").select("*").order("name"),
      ]);
      setOrders((o as Order[]) ?? []);
      setRecipes((r as Recipe[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const save = async () => {
    if (!form.clientName || !form.productName || !form.deliveryDate) {
      notify("Completa cliente, producto y fecha de entrega");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const row = {
      id: uid(),
      user_id: userData.user!.id,
      client_name: form.clientName,
      client_phone: form.clientPhone,
      product_name: form.productName,
      recipe_id: form.recipeId || null,
      quantity: parseFloat(form.quantity) || 1,
      unit_price: parseFloat(form.unitPrice) || 0,
      delivery_date: form.deliveryDate,
      notes: form.notes,
      deposit: parseFloat(form.deposit) || 0,
      status: "pendiente" as OrderStatus,
      invoice_mode: form.invoiceMode,
      ncf: form.ncf,
    };
    const { data, error } = await supabase.from("orders").insert(row).select().single();
    if (error) { notify("No se pudo guardar el pedido"); return; }
    setOrders([data as Order, ...orders]);
    setForm(blank());
    setShowForm(false);
    notify("Pedido creado");
  };

  const remove = async (id: string) => {
    await supabase.from("orders").delete().eq("id", id);
    setOrders(orders.filter((o) => o.id !== id));
  };

  const setStatus = async (id: string, status: OrderStatus) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  if (loading) return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Nuevo pedido</SectionTitle>
          <button onClick={() => setShowForm(false)} style={{ color: "#8A7A75" }}><X size={18} /></button>
        </div>
        <Card>
          <div className="space-y-3">
            <Field label="Nombre del cliente">
              <input style={inputStyle} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            </Field>
            <Field label="Teléfono del cliente">
              <input style={inputStyle} value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="809-000-0000" />
            </Field>
            <Field label="Producto">
              <select
                style={inputStyle}
                value={form.recipeId}
                onChange={(e) => {
                  const recipe = recipes.find((r) => r.id === e.target.value);
                  setForm({ ...form, recipeId: e.target.value, productName: recipe ? recipe.name : form.productName });
                }}
              >
                <option value="">Elegir de tus recetas</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input
                style={{ ...inputStyle, marginTop: 6 }}
                placeholder="O escribe el producto aquí"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value, recipeId: "" })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <input style={inputStyle} type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </Field>
              <Field label="Precio unitario (RD$)">
                <input style={inputStyle} type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
              </Field>
            </div>
            <Field label="Fecha de entrega">
              <input style={inputStyle} type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </Field>
            <Field label="Abono recibido (RD$, opcional)">
              <input style={inputStyle} type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </Field>
            <Field label="Notas importantes">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sin nueces, diseño personalizado, alergias…" />
            </Field>
          </div>
        </Card>

        <Card>
          <span className="text-[11px] font-medium block mb-2" style={{ color: "#7A6B66" }}>Tipo de comprobante</span>
          <div className="flex gap-2 mb-3">
            {(["simple", "fiscal"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setForm({ ...form, invoiceMode: m })}
                className="flex-1 text-xs font-semibold py-2 rounded-lg border"
                style={{
                  borderColor: form.invoiceMode === m ? "#1B2A4A" : "#E4D8C6",
                  background: form.invoiceMode === m ? "#EFE3D2" : "#fff",
                  color: "#101B33",
                }}
              >
                {m === "simple" ? "Recibo simple" : "Factura fiscal (RNC/NCF)"}
              </button>
            ))}
          </div>
          {form.invoiceMode === "fiscal" && (
            <Field label="NCF de esta factura (según tu talonario/secuencia DGII)">
              <input style={inputStyle} value={form.ncf} onChange={(e) => setForm({ ...form, ncf: e.target.value })} placeholder="Ej. B0100000123" />
            </Field>
          )}
        </Card>

        <PrimaryButton onClick={save} full>Guardar pedido</PrimaryButton>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle sub="Registra pedidos y genera la factura para tu cliente en segundos.">Pedidos y Facturas</SectionTitle>
      <PrimaryButton onClick={() => { setForm(blank()); setShowForm(true); }} full><Plus size={16} /> Nuevo pedido</PrimaryButton>

      <div className="space-y-2">
        {orders.length === 0 && <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>No tienes pedidos registrados.</p>}
        {orders.map((o) => {
          const total = (Number(o.unit_price) || 0) * (Number(o.quantity) || 0);
          const st = STATUS[o.status];
          return (
            <Card key={o.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm" style={{ color: "#101B33" }}>{o.client_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>{o.product_name} · x{o.quantity}</div>
                  <div className="text-xs flex items-center gap-1 mt-1" style={{ color: "#8A7A75" }}>
                    <Clock size={11} /> entrega {o.delivery_date || "—"}
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              {o.notes && (
                <div className="flex items-start gap-1 mt-2 text-xs" style={{ color: "#A9822F" }}>
                  <AlertCircle size={12} className="mt-0.5 shrink-0" /> {o.notes}
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid #E4D8C6" }}>
                <span style={{ fontFamily: "var(--font-plex-mono)" }} className="text-sm font-semibold">{money(total)}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={o.status}
                    onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}
                    className="text-[11px] rounded-md border px-1.5 py-1"
                    style={{ borderColor: "#E4D8C6" }}
                  >
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <Link href={`/dashboard/pedidos/${o.id}/factura`} className="text-xs font-semibold px-2.5 py-1.5 rounded-md" style={{ background: "#1B2A4A", color: "#fff" }}>Factura</Link>
                  <button onClick={() => remove(o.id)} style={{ color: "#B25C5C" }}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Toast message={toast} />
    </div>
  );
}
