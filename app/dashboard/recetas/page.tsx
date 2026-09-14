"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { uid } from "@/lib/constants";
import { buildRecipeGraph, computeRecipeCost, money, wouldCreateCycle } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, Row, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Recipe, RecipeComponent, RecipeSupplyItem, Supply } from "@/lib/types";

interface DraftItem { key: string; supplyId: string; qty: string }
interface DraftComponent { key: string; componentRecipeId: string; fraction: string }
interface Draft {
  id: string;
  isNew: boolean;
  name: string;
  portions: string;
  laborHours: string;
  laborRate: string;
  indirectPct: string;
  marginPct: string;
  items: DraftItem[];
  components: DraftComponent[];
}

export default function RecetasPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toast, notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [supplyItems, setSupplyItems] = useState<RecipeSupplyItem[]>([]);
  const [components, setComponents] = useState<RecipeComponent[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: si }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("recipes").select("*").order("created_at", { ascending: false }),
      supabase.from("recipe_supply_items").select("*"),
      supabase.from("recipe_components").select("*"),
      supabase.from("supplies").select("*").order("name"),
    ]);
    setRecipes((r as Recipe[]) ?? []);
    setSupplyItems((si as RecipeSupplyItem[]) ?? []);
    setComponents((c as RecipeComponent[]) ?? []);
    setSupplies((s as Supply[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supabase]);

  const graph = useMemo(
    () => buildRecipeGraph(recipes, supplyItems, components, supplies),
    [recipes, supplyItems, components, supplies]
  );

  const blank = (): Draft => ({
    id: uid(),
    isNew: true,
    name: "",
    portions: "1",
    laborHours: "",
    laborRate: "",
    indirectPct: "10",
    marginPct: "40",
    items: [],
    components: [],
  });

  const openNew = () => setDraft(blank());

  const openEdit = (r: Recipe) => {
    setDraft({
      id: r.id,
      isNew: false,
      name: r.name,
      portions: String(r.portions),
      laborHours: String(r.labor_hours),
      laborRate: String(r.labor_rate),
      indirectPct: String(r.indirect_pct),
      marginPct: String(r.margin_pct),
      items: (graph.supplyItemsByRecipe[r.id] ?? []).map((it) => ({ key: it.id, supplyId: it.supply_id, qty: String(it.qty) })),
      components: (graph.componentsByRecipe[r.id] ?? []).map((c) => ({ key: c.id, componentRecipeId: c.component_recipe_id, fraction: String(c.fraction) })),
    });
  };

  // Costo en vivo del borrador: reusa el grafo guardado para las sub-recetas
  // (ya persistidas) y combina con los ítems/componentes que se están editando.
  const draftCost = useMemo(() => {
    if (!draft) return null;
    let ingredientCost = 0;
    let insumoCost = 0;
    for (const it of draft.items) {
      const supply = supplies.find((s) => s.id === it.supplyId);
      if (!supply) continue;
      const cost = Number(supply.unit_cost) * (parseFloat(it.qty) || 0);
      if (supply.kind === "insumo") insumoCost += cost; else ingredientCost += cost;
    }
    const subRecipeDetails = draft.components.map((c) => {
      const fraction = parseFloat(c.fraction) || 0;
      let cost = 0;
      try {
        cost = computeRecipeCost(c.componentRecipeId, graph).totalCost * fraction;
      } catch {
        cost = 0;
      }
      return { name: recipes.find((r) => r.id === c.componentRecipeId)?.name ?? "Sub-receta", fraction, cost };
    });
    const subRecipeCost = subRecipeDetails.reduce((s, d) => s + d.cost, 0);
    const laborCost = (parseFloat(draft.laborHours) || 0) * (parseFloat(draft.laborRate) || 0);
    const subtotal = ingredientCost + insumoCost + subRecipeCost + laborCost;
    const indirectCost = subtotal * ((parseFloat(draft.indirectPct) || 0) / 100);
    const totalCost = subtotal + indirectCost;
    const portions = parseFloat(draft.portions) || 1;
    const costPerPortion = totalCost / portions;
    const suggestedTotal = totalCost * (1 + (parseFloat(draft.marginPct) || 0) / 100);
    const pricePerPortion = suggestedTotal / portions;
    return { ingredientCost, insumoCost, subRecipeCost, subRecipeDetails, laborCost, subtotal, indirectCost, totalCost, costPerPortion, suggestedTotal, pricePerPortion };
  }, [draft, supplies, graph, recipes]);

  const availableComponentRecipes = (excludeKey: string) =>
    recipes.filter((r) => {
      if (!draft) return false;
      if (r.id === draft.id) return false;
      // Ya elegido en otra fila del borrador
      if (draft.components.some((c) => c.key !== excludeKey && c.componentRecipeId === r.id)) return false;
      return !wouldCreateCycle(graph, draft.id, r.id);
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name || (draft.items.length === 0 && draft.components.length === 0)) {
      notify("Ponle nombre y al menos un ingrediente o sub-receta");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user!.id;

    const recipeRow = {
      id: draft.id,
      user_id: userId,
      name: draft.name,
      portions: parseFloat(draft.portions) || 1,
      labor_hours: parseFloat(draft.laborHours) || 0,
      labor_rate: parseFloat(draft.laborRate) || 0,
      indirect_pct: parseFloat(draft.indirectPct) || 0,
      margin_pct: parseFloat(draft.marginPct) || 0,
    };

    const { error: recipeError } = await supabase.from("recipes").upsert(recipeRow);
    if (recipeError) { notify("No se pudo guardar la receta"); return; }

    await supabase.from("recipe_supply_items").delete().eq("recipe_id", draft.id);
    await supabase.from("recipe_components").delete().eq("recipe_id", draft.id);

    const validItems = draft.items.filter((it) => it.supplyId && parseFloat(it.qty) > 0);
    if (validItems.length) {
      await supabase.from("recipe_supply_items").insert(
        validItems.map((it) => ({ id: uid(), recipe_id: draft.id, supply_id: it.supplyId, qty: parseFloat(it.qty) }))
      );
    }
    const validComponents = draft.components.filter((c) => c.componentRecipeId && parseFloat(c.fraction) > 0);
    if (validComponents.length) {
      await supabase.from("recipe_components").insert(
        validComponents.map((c) => ({ id: uid(), recipe_id: draft.id, component_recipe_id: c.componentRecipeId, fraction: parseFloat(c.fraction) }))
      );
    }

    notify("Receta guardada");
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) { notify("No se pudo borrar (puede estar usada como sub-receta o en un pedido)"); return; }
    setRecipes(recipes.filter((r) => r.id !== id));
  };

  if (loading) return <p className="text-sm text-center py-10" style={{ color: "#B0A29C" }}>Cargando…</p>;

  if (draft) {
    const c = draftCost!;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>{draft.isNew ? "Nueva receta" : "Editar receta"}</SectionTitle>
          <button onClick={() => setDraft(null)} style={{ color: "#8A7A75" }}><X size={18} /></button>
        </div>

        <Card>
          <div className="space-y-3">
            <Field label="Nombre del producto">
              <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Vasito de bizcocho" />
            </Field>
            <Field label="Cantidad de porciones que rinde">
              <input style={inputStyle} type="number" value={draft.portions} onChange={(e) => setDraft({ ...draft, portions: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: "#101B33" }}>Ingredientes e insumos usados</span>
            <button
              onClick={() => {
                if (supplies.length === 0) { notify("Agrega ingredientes o insumos primero"); return; }
                setDraft({ ...draft, items: [...draft.items, { key: uid(), supplyId: supplies[0].id, qty: "" }] });
              }}
              className="text-xs font-medium flex items-center gap-1" style={{ color: "#1B2A4A" }}
            >
              <Plus size={13} /> agregar
            </button>
          </div>
          <div className="space-y-2">
            {draft.items.map((it) => {
              const supply = supplies.find((s) => s.id === it.supplyId);
              return (
                <div key={it.key} className="flex items-center gap-2">
                  <select
                    style={{ ...inputStyle, flex: 2 }}
                    value={it.supplyId}
                    onChange={(e) => setDraft({ ...draft, items: draft.items.map((x) => x.key === it.key ? { ...x, supplyId: e.target.value } : x) })}
                  >
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} {s.kind === "insumo" ? "(insumo)" : ""}</option>
                    ))}
                  </select>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="number"
                    placeholder={supply ? supply.unit : "cant"}
                    value={it.qty}
                    onChange={(e) => setDraft({ ...draft, items: draft.items.map((x) => x.key === it.key ? { ...x, qty: e.target.value } : x) })}
                  />
                  <button onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.key !== it.key) })} style={{ color: "#B25C5C" }}><Trash2 size={15} /></button>
                </div>
              );
            })}
            {draft.items.length === 0 && <p className="text-xs" style={{ color: "#B0A29C" }}>Sin ingredientes ni insumos aún.</p>}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: "#101B33" }}>Sub-recetas usadas</span>
            <button
              onClick={() => {
                const options = availableComponentRecipes("");
                if (options.length === 0) { notify("No hay otras recetas disponibles para usar como sub-receta"); return; }
                setDraft({ ...draft, components: [...draft.components, { key: uid(), componentRecipeId: options[0].id, fraction: "1" }] });
              }}
              className="text-xs font-medium flex items-center gap-1" style={{ color: "#1B2A4A" }}
            >
              <Plus size={13} /> agregar
            </button>
          </div>
          <p className="text-[11px] mb-2" style={{ color: "#8A7A75" }}>
            Usa otra receta ya guardada como componente. La proporción es la fracción de esa receta que usas aquí
            (ej. 0.25 = 1/4 de la receta de crema pastelera).
          </p>
          <div className="space-y-2">
            {draft.components.map((c) => (
              <div key={c.key} className="flex items-center gap-2">
                <select
                  style={{ ...inputStyle, flex: 2 }}
                  value={c.componentRecipeId}
                  onChange={(e) => setDraft({ ...draft, components: draft.components.map((x) => x.key === c.key ? { ...x, componentRecipeId: e.target.value } : x) })}
                >
                  {[...availableComponentRecipes(c.key), recipes.find((r) => r.id === c.componentRecipeId)].filter(
                    (r, idx, arr): r is Recipe => !!r && arr.findIndex((x) => x?.id === r.id) === idx
                  ).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="number" step="0.05"
                  placeholder="0.25"
                  value={c.fraction}
                  onChange={(e) => setDraft({ ...draft, components: draft.components.map((x) => x.key === c.key ? { ...x, fraction: e.target.value } : x) })}
                />
                <button onClick={() => setDraft({ ...draft, components: draft.components.filter((x) => x.key !== c.key) })} style={{ color: "#B25C5C" }}><Trash2 size={15} /></button>
              </div>
            ))}
            {draft.components.length === 0 && <p className="text-xs" style={{ color: "#B0A29C" }}>Sin sub-recetas aún.</p>}
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Horas de mano de obra">
              <input style={inputStyle} type="number" value={draft.laborHours} onChange={(e) => setDraft({ ...draft, laborHours: e.target.value })} placeholder="2" />
            </Field>
            <Field label="Tarifa por hora (RD$)">
              <input style={inputStyle} type="number" value={draft.laborRate} onChange={(e) => setDraft({ ...draft, laborRate: e.target.value })} placeholder="150" />
            </Field>
            <Field label="Costos indirectos (%)">
              <input style={inputStyle} type="number" value={draft.indirectPct} onChange={(e) => setDraft({ ...draft, indirectPct: e.target.value })} />
            </Field>
            <Field label="Margen de ganancia (%)">
              <input style={inputStyle} type="number" value={draft.marginPct} onChange={(e) => setDraft({ ...draft, marginPct: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card style={{ background: "#EFE3D2", border: "none" }}>
          <div style={{ fontFamily: "var(--font-plex-mono)" }} className="text-sm space-y-1.5">
            <Row label="Costo ingredientes" val={money(c.ingredientCost)} />
            <Row label="Costo insumos/empaque" val={money(c.insumoCost)} />
            {c.subRecipeDetails.map((d, i) => (
              <Row key={i} label={`Sub-receta: ${d.name} (${d.fraction})`} val={money(d.cost)} />
            ))}
            <Row label="Costo mano de obra" val={money(c.laborCost)} />
            <div style={{ borderTop: "1px dashed #1B2A4A", margin: "6px 0" }} />
            <Row label="Costos indirectos" val={money(c.indirectCost)} />
            <Row label="Costo total" val={money(c.totalCost)} bold />
            <Row label="Costo por porción" val={money(c.costPerPortion)} />
            <div style={{ borderTop: "1px dashed #1B2A4A", margin: "6px 0" }} />
            <Row label="Precio de venta sugerido" val={money(c.suggestedTotal)} highlight />
            <Row label="Precio por porción" val={money(c.pricePerPortion)} highlight />
          </div>
        </Card>

        <PrimaryButton onClick={save} full>Guardar receta</PrimaryButton>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle sub="Calcula el costo real y el precio sugerido de cada producto, incluyendo sub-recetas.">Costos y Precios</SectionTitle>
      <PrimaryButton onClick={openNew} full><Plus size={16} /> Nueva receta</PrimaryButton>

      <div className="space-y-2">
        {recipes.length === 0 && <p className="text-sm text-center py-6" style={{ color: "#B0A29C" }}>Aún no tienes recetas calculadas.</p>}
        {recipes.map((r) => {
          let costTotal = 0, suggestedTotal = 0, errorMsg: string | null = null;
          try {
            const cc = computeRecipeCost(r.id, graph);
            costTotal = cc.totalCost; suggestedTotal = cc.suggestedTotal;
          } catch (e) {
            errorMsg = e instanceof Error ? e.message : "Error de cálculo";
          }
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ fontFamily: "var(--font-fraunces)", color: "#101B33" }} className="font-semibold">{r.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#8A7A75" }}>{r.portions} porciones</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(r)} className="text-xs font-medium" style={{ color: "#1B2A4A" }}>editar</button>
                  <button onClick={() => remove(r.id)} style={{ color: "#B25C5C" }}><Trash2 size={15} /></button>
                </div>
              </div>
              {errorMsg ? (
                <p className="text-xs mt-2" style={{ color: "#B25C5C" }}>{errorMsg}</p>
              ) : (
                <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid #E4D8C6", fontFamily: "var(--font-plex-mono)" }}>
                  <span className="text-xs" style={{ color: "#8A7A75" }}>Costo: {money(costTotal)}</span>
                  <span className="text-sm font-semibold" style={{ color: "#6E8A70" }}>Precio sugerido: {money(suggestedTotal)}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <Toast message={toast} />
    </div>
  );
}
