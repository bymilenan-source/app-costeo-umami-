"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Trash2, Clock, AlertCircle, X, Pencil, CalendarPlus } from "lucide-react";
import { STATUS, uid } from "@/lib/constants";
import { buildRecipeGraph, computeRecipeCost, money, type RecipeGraph } from "@/lib/costing";
import { deriveClients, matchClients } from "@/lib/clients";
import { itemTotal, itemsSummary, orderItems, orderTotal } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Order, OrderItem, OrderStatus, Recipe, RecipeComponent, RecipeSupplyItem, Supply } from "@/lib/types";

function googleCalendarUrl(order: Order) {
  if (!order.delivery_date) return null;
  const start = order.delivery_date.replace(/-/g, "");
  const endDate = new Date(`${order.delivery_date}T00:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Entrega: ${order.client_name} — ${itemsSummary(orderItems(order))}`,
    dates: `${start}/${end}`,
    details: `Pedido de ${order.client_name}: ${itemsSummary(orderItems(order))}.${order.notes ? ` Notas: ${order.notes}` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

type DraftItem = { key: string; recipeId: string; productName: string; quantity: string; unitPrice: string };

const blankItem = (): DraftItem => ({ key: uid(), recipeId: "", productName: "", quantity: "1", unitPrice: "" });

const toDraftItems = (items: OrderItem[]): DraftItem[] =>
  items.map((it) => ({
    key: uid(),
    recipeId: it.recipe_id ?? "",
    productName: it.product_name,
    quantity: String(it.quantity),
    unitPrice: String(it.unit_price),
  }));

function PedidosPageInner() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useProfile();
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [graph, setGraph] = useState<RecipeGraph | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const blank = () => ({
    clientName: "", clientPhone: "", items: [blankItem()] as DraftItem[],
    deliveryDate: "", notes: "", deposit: "",
    invoiceMode: profile.invoice_mode, ncf: "",
  });
  const [form, setForm] = useState(blank());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: o }, { data: r }, { data: si }, { data: c }, { data: s }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("recipes").select("*").order("name"),
        supabase.from("recipe_supply_items").select("*"),
        supabase.from("recipe_components").select("*"),
        supabase.from("supplies").select("*"),
      ]);
      setOrders((o as Order[]) ?? []);
      setRecipes((r as Recipe[]) ?? []);
      setGraph(buildRecipeGraph(
        (r as Recipe[]) ?? [],
        (si as RecipeSupplyItem[]) ?? [],
        (c as RecipeComponent[]) ?? [],
        (s as Supply[]) ?? []
      ));
      setLoading(false);
    })();
  }, [supabase]);

  const openNew = () => {
    setEditingId(null);
    setForm(blank());
    setShowForm(true);
  };

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setForm({
      clientName: o.client_name,
      clientPhone: o.client_phone,
      items: toDraftItems(orderItems(o)),
      deliveryDate: o.delivery_date ?? "",
      notes: o.notes,
      deposit: String(o.deposit),
      invoiceMode: o.invoice_mode,
      ncf: o.ncf,
    });
    setShowForm(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading) return;
    const target = orders.find((o) => o.id === editId);
    if (target) {
      (() => {
        openEdit(target);
        router.replace("/dashboard/pedidos");
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, orders]);

  // Llegada desde la sección Clientes: ?nuevo=1&cliente=…&tel=…[&repetir=<id pedido>]
  useEffect(() => {
    if (loading || searchParams.get("nuevo") !== "1") return;
    (() => {
      const base = blank();
      const prev = orders.find((o) => o.id === searchParams.get("repetir"));
      setEditingId(null);
      setForm({
        ...base,
        clientName: searchParams.get("cliente") ?? "",
        clientPhone: searchParams.get("tel") ?? "",
        ...(prev
          ? {
              items: toDraftItems(orderItems(prev)),
              notes: prev.notes,
              invoiceMode: prev.invoice_mode,
            }
          : {}),
      });
      setShowForm(true);
      router.replace("/dashboard/pedidos");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, orders]);

  const clients = useMemo(() => deriveClients(orders), [orders]);
  const nameSuggestions = nameFocused && !editingId
    ? matchClients(clients, form.clientName).filter((c) => c.name !== form.clientName)
    : [];

  const recipePrice = (recipeId: string) => {
    if (!recipeId || !graph) return null;
    try {
      const c = computeRecipeCost(recipeId, graph);
      const portions = Number(graph.recipes[recipeId]?.portions) || 1;
      return { whole: c.suggestedTotal, perPortion: c.pricePerPortion, portions };
    } catch {
      return null;
    }
  };

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  const removeItem = (key: string) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((it) => it.key !== key) : f.items }));

  const draftItems: OrderItem[] = form.items
    .filter((it) => it.productName.trim())
    .map((it) => ({
      product_name: it.productName.trim(),
      recipe_id: it.recipeId || null,
      quantity: parseFloat(it.quantity) || 1,
      unit_price: parseFloat(it.unitPrice) || 0,
    }));
  const draftTotal = draftItems.reduce((s, it) => s + itemTotal(it), 0);

  const save = async () => {
    if (!form.clientName || draftItems.length === 0 || !form.deliveryDate) {
      notify("Completa cliente, al menos un producto y fecha de entrega");
      return;
    }
    // Las columnas sueltas guardan un resumen (cantidad 1 × total) para que los
    // pedidos de un solo producto y los cálculos viejos sigan funcionando.
    const single = draftItems.length === 1 ? draftItems[0] : null;
    const patch = {
      client_name: form.clientName,
      client_phone: form.clientPhone,
      items: draftItems,
      product_name: single ? single.product_name : itemsSummary(draftItems),
      recipe_id: single ? single.recipe_id : null,
      quantity: single ? single.quantity : 1,
      unit_price: single ? single.unit_price : draftTotal,
      delivery_date: form.deliveryDate,
      notes: form.notes,
      deposit: parseFloat(form.deposit) || 0,
      invoice_mode: form.invoiceMode,
      ncf: form.ncf,
    };

    // Si la base de datos aún no tiene la columna `items` (falta correr la
    // migración 0004), se guarda sin ella: el pedido queda como una sola línea
    // con el resumen y el total correcto, en vez de fallar.
    const missingItemsColumn = (e: { message?: string } | null) => !!e?.message?.includes("items");

    if (editingId) {
      let { data, error } = await supabase.from("orders").update(patch).eq("id", editingId).select().single();
      if (missingItemsColumn(error)) {
        const { items: _omit, ...legacy } = patch; void _omit;
        ({ data, error } = await supabase.from("orders").update(legacy).eq("id", editingId).select().single());
      }
      if (error) { notify("No se pudo actualizar el pedido"); return; }
      setOrders(orders.map((o) => (o.id === editingId ? (data as Order) : o)));
      setShowForm(false);
      setEditingId(null);
      notify("Pedido actualizado");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const row = { id: uid(), user_id: userData.user!.id, status: "pendiente" as OrderStatus, ...patch };
    let { data, error } = await supabase.from("orders").insert(row).select().single();
    if (missingItemsColumn(error)) {
      const { items: _omit, ...legacy } = row; void _omit;
      ({ data, error } = await supabase.from("orders").insert(legacy).select().single());
    }
    if (error) { notify("No se pudo guardar el pedido"); return; }
    setOrders([data as Order, ...orders]);
    setForm(blank());
    setShowForm(false);
    notify("Pedido creado");
  };

  const remove = async (id: string) => {
    await supabase.from("orders").delete().eq("id", id);
    setOrders(orders.filter((o) => o.id !== id));
    if (editingId === id) { setShowForm(false); setEditingId(null); }
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
          <SectionTitle>{editingId ? "Editar pedido" : "Nuevo pedido"}</SectionTitle>
          <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ color: "#8A7A75" }}><X size={18} /></button>
        </div>
        <Card>
          <div className="space-y-3">
            <Field label="Nombre del cliente">
              <input
                style={inputStyle}
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                placeholder="Escribe y elige si ya es cliente"
                autoComplete="off"
              />
              {nameSuggestions.length > 0 && (
                <div className="mt-1 rounded-lg border overflow-hidden" style={{ borderColor: "#E4D8C6", background: "#fff" }}>
                  {nameSuggestions.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setForm({ ...form, clientName: c.name, clientPhone: c.phone || form.clientPhone }); setNameFocused(false); }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2"
                      style={{ borderBottom: "1px solid #F1E9DC", color: "#101B33" }}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-xs shrink-0" style={{ color: "#8A7A75" }}>{c.phone || `${c.orderCount} pedidos`}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Teléfono del cliente">
              <input style={inputStyle} value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="809-000-0000" />
            </Field>
            <div className="space-y-3">
              <span className="text-[11px] font-medium block" style={{ color: "#7A6B66" }}>
                Productos{form.items.length > 1 ? ` (${form.items.length})` : ""}
              </span>
              {form.items.map((it, idx) => {
                const rp = recipePrice(it.recipeId);
                return (
                  <div key={it.key} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid #E4D8C6", background: "#FFFDF9" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold" style={{ color: "#8A7A75" }}>Producto {idx + 1}</span>
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(it.key)} aria-label="Quitar producto" style={{ color: "#B25C5C" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <select
                      style={inputStyle}
                      value={it.recipeId}
                      onChange={(e) => {
                        const recipe = recipes.find((r) => r.id === e.target.value);
                        let unitPrice = it.unitPrice;
                        if (recipe && graph && !it.unitPrice) {
                          try { unitPrice = String(Math.round(computeRecipeCost(recipe.id, graph).suggestedTotal)); } catch { /* sin precio */ }
                        }
                        setItem(it.key, { recipeId: e.target.value, productName: recipe ? recipe.name : it.productName, unitPrice });
                      }}
                    >
                      <option value="">Elegir de tus recetas</option>
                      {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <input
                      style={inputStyle}
                      placeholder="O escribe el producto aquí"
                      value={it.productName}
                      onChange={(e) => setItem(it.key, { productName: e.target.value, recipeId: "" })}
                    />
                    {rp && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setItem(it.key, { unitPrice: String(Math.round(rp.whole)) })}
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md border"
                          style={{ borderColor: "#E4D8C6", color: "#1B2A4A", background: "#FFF9F0" }}
                        >
                          Receta completa: {money(Math.round(rp.whole))}
                        </button>
                        {rp.portions > 1 && (
                          <button
                            type="button"
                            onClick={() => setItem(it.key, { unitPrice: String(Math.round(rp.perPortion)) })}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-md border"
                            style={{ borderColor: "#E4D8C6", color: "#1B2A4A", background: "#FFF9F0" }}
                          >
                            Por porción: {money(Math.round(rp.perPortion))}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Cantidad">
                        <input style={inputStyle} type="number" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(it.key, { quantity: e.target.value })} />
                      </Field>
                      <Field label="Precio unitario (RD$)">
                        <input style={inputStyle} type="number" inputMode="decimal" value={it.unitPrice} onChange={(e) => setItem(it.key, { unitPrice: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addItem}
                className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-lg border"
                style={{ borderColor: "#1B2A4A", color: "#1B2A4A", borderStyle: "dashed" }}
              >
                <Plus size={15} /> Agregar otro producto
              </button>
              <div className="flex items-center justify-between text-sm font-semibold pt-1" style={{ color: "#101B33" }}>
                <span>Total del pedido</span>
                <span style={{ fontFamily: "var(--font-plex-mono)" }}>{money(draftTotal)}</span>
              </div>
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

        <PrimaryButton onClick={save} full>{editingId ? "Guardar cambios" : "Guardar pedido"}</PrimaryButton>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle sub="Registra pedidos y genera la factura para tu cliente en segundos.">Pedidos y Facturas</SectionTitle>
      <PrimaryButton onClick={openNew} full><Plus size={16} /> Nuevo pedido</PrimaryButton>

      <div className="space-y-2">
        {orders.length === 0 && <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>No tienes pedidos registrados.</p>}
        {orders.map((o) => {
          const total = orderTotal(o);
          const st = STATUS[o.status];
          return (
            <Card key={o.id}>
              <div className="flex items-start justify-between">
                <button className="text-left flex-1" onClick={() => openEdit(o)}>
                  <div className="font-semibold text-sm" style={{ color: "#101B33" }}>{o.client_name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>{itemsSummary(orderItems(o))}</div>
                  <div className="text-xs flex items-center gap-1 mt-1" style={{ color: "#8A7A75" }}>
                    <Clock size={11} /> entrega {o.delivery_date || "—"}
                  </div>
                </button>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
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
                  <button onClick={() => openEdit(o)} style={{ color: "#1B2A4A" }}><Pencil size={15} /></button>
                  {googleCalendarUrl(o) && (
                    <a
                      href={googleCalendarUrl(o)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Agregar a mi calendario"
                      style={{ color: "#1B2A4A" }}
                    >
                      <CalendarPlus size={15} />
                    </a>
                  )}
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

export default function PedidosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>}>
      <PedidosPageInner />
    </Suspense>
  );
}
