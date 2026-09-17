"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { UNITS, uid } from "@/lib/constants";
import { money } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Supply, SupplyKind } from "@/lib/types";

const COPY: Record<SupplyKind, { title: string; sub: string; nameLabel: string; namePlaceholder: string; empty: string }> = {
  ingrediente: {
    title: "Ingredientes",
    sub: "Guarda el costo real de cada ingrediente de comida una sola vez y reúsalo en todas tus recetas.",
    nameLabel: "Nombre del ingrediente",
    namePlaceholder: "Ej. Harina de trigo",
    empty: "Aún no has agregado ingredientes.",
  },
  insumo: {
    title: "Insumos y empaque",
    sub: "Vasos, servilletas, cajas, etiquetas y demás insumos no comestibles, separados del costo de comida.",
    nameLabel: "Nombre del insumo",
    namePlaceholder: "Ej. Caja para 6 unidades",
    empty: "Aún no has agregado insumos.",
  },
};

const blankForm = (unit: string) => ({ name: "", purchaseQty: "", unit, purchaseCost: "" });

export function SupplyList({ kind }: { kind: SupplyKind }) {
  const copy = COPY[kind];
  const supabase = useMemo(() => createClient(), []);
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Supply[]>([]);
  const [form, setForm] = useState(blankForm("g"));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("supplies").select("*").eq("kind", kind).order("created_at", { ascending: false });
      setItems((data as Supply[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, kind]);

  const unitCost = () => {
    const q = parseFloat(form.purchaseQty);
    const c = parseFloat(form.purchaseCost);
    if (!q || !c) return 0;
    return c / q;
  };

  const startEdit = (item: Supply) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      purchaseQty: String(item.purchase_qty),
      unit: item.unit,
      purchaseCost: String(item.purchase_cost),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm(form.unit));
  };

  const save = async () => {
    if (!form.name || !form.purchaseQty || !form.purchaseCost) {
      notify("Completa nombre, cantidad y costo");
      return;
    }
    const patch = {
      name: form.name,
      unit: form.unit,
      purchase_qty: parseFloat(form.purchaseQty),
      purchase_cost: parseFloat(form.purchaseCost),
    };

    if (editingId) {
      const { data, error } = await supabase.from("supplies").update(patch).eq("id", editingId).select().single();
      if (error) { notify("No se pudo actualizar"); return; }
      setItems(items.map((i) => (i.id === editingId ? (data as Supply) : i)));
      cancelEdit();
      notify(kind === "ingrediente" ? "Ingrediente actualizado" : "Insumo actualizado");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const row = { id: uid(), user_id: userData.user!.id, kind, ...patch };
    const { data, error } = await supabase.from("supplies").insert(row).select().single();
    if (error) { notify("No se pudo guardar"); return; }
    setItems([data as Supply, ...items]);
    setForm(blankForm(form.unit));
    notify(kind === "ingrediente" ? "Ingrediente guardado" : "Insumo guardado");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("supplies").delete().eq("id", id);
    if (error) {
      notify(
        error.code === "23503"
          ? "No se pudo eliminar: está usado en una receta"
          : "No se pudo eliminar, intenta de nuevo"
      );
      return;
    }
    setItems(items.filter((i) => i.id !== id));
    if (editingId === id) cancelEdit();
  };

  if (loading) return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;

  return (
    <div className="space-y-4">
      <SectionTitle sub={copy.sub}>{copy.title}</SectionTitle>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: "#101B33" }}>
            {editingId ? `Editando: ${items.find((i) => i.id === editingId)?.name ?? ""}` : "Nuevo"}
          </span>
          {editingId && (
            <button onClick={cancelEdit} className="text-xs font-medium flex items-center gap-1" style={{ color: "#8A7A75" }}>
              <X size={12} /> Cancelar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={copy.nameLabel}>
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={copy.namePlaceholder} />
            </Field>
          </div>
          <Field label="Cantidad comprada">
            <input style={inputStyle} type="number" value={form.purchaseQty} onChange={(e) => setForm({ ...form, purchaseQty: e.target.value })} placeholder="1000" />
          </Field>
          <Field label="Unidad">
            <select style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Costo total de esa compra (RD$)">
              <input style={inputStyle} type="number" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} placeholder="150" />
            </Field>
          </div>
        </div>
        <div className="mt-3 text-xs" style={{ fontFamily: "var(--font-plex-mono)", color: "#6E8A70" }}>
          Costo por {form.unit || "unidad"}: {money(unitCost())}
        </div>
        <div className="mt-3">
          <PrimaryButton onClick={save} full>
            {editingId ? "Guardar cambios" : (
              <>
                <Plus size={16} /> Guardar {kind === "ingrediente" ? "ingrediente" : "insumo"}
              </>
            )}
          </PrimaryButton>
        </div>
      </Card>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>{copy.empty}</p>}
        {items.map((i) => (
          <Card key={i.id} style={{ padding: 12, borderColor: editingId === i.id ? "#1B2A4A" : undefined }}>
            <div className="flex items-center justify-between">
              <button className="text-left flex-1" onClick={() => startEdit(i)}>
                <div className="text-sm font-semibold" style={{ color: "#101B33" }}>{i.name}</div>
                <div className="text-xs" style={{ fontFamily: "var(--font-plex-mono)", color: "#8A7A75" }}>
                  {money(i.purchase_cost)} por {i.purchase_qty}{i.unit} · {money(i.unit_cost)}/{i.unit}
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <button onClick={() => startEdit(i)} style={{ color: "#1B2A4A" }}><Pencil size={15} /></button>
                <button onClick={() => remove(i.id)} style={{ color: "#B25C5C" }}><Trash2 size={16} /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Toast message={toast} />
    </div>
  );
}
