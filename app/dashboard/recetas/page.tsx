"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { uid } from "@/lib/constants";
import { buildRecipeGraph, computeRecipeCost, money, wouldCreateCycle } from "@/lib/costing";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/useToast";
import { Card, Field, PrimaryButton, Row, SectionTitle, Toast, inputStyle } from "@/components/ui";
import type { Recipe, RecipeComponent, RecipeSupplyItem, Supply } from "@/lib/types";

// Acepta "1,5" y "1.5": en teclados en español la coma es el decimal y
// un <input type="text" inputMode="decimal"> la rechazaba dejando la cantidad vacía.
const toNum = (v: string | number) => {
  const n = parseFloat(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

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
  // Error de guardado visible hasta que se corrija (el toast dura 2 s y se perdía).
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
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

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

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
      const cost = Number(supply.unit_cost) * (toNum(it.qty) || 0);
      if (supply.kind === "insumo") insumoCost += cost; else ingredientCost += cost;
    }
    const subRecipeDetails = draft.components.map((c) => {
      const fraction = toNum(c.fraction) || 0;
      let cost = 0;
      try {
        cost = computeRecipeCost(c.componentRecipeId, graph).totalCost * fraction;
      } catch {
        cost = 0;
      }
      return { name: recipes.find((r) => r.id === c.componentRecipeId)?.name ?? "Sub-receta", fraction, cost };
    });
    const subRecipeCost = subRecipeDetails.reduce((s, d) => s + d.cost, 0);
    const laborCost = (toNum(draft.laborHours) || 0) * (toNum(draft.laborRate) || 0);
    const subtotal = ingredientCost + insumoCost + subRecipeCost + laborCost;
    const indirectCost = subtotal * ((toNum(draft.indirectPct) || 0) / 100);
    const totalCost = subtotal + indirectCost;
    const portions = toNum(draft.portions) || 1;
    const costPerPortion = totalCost / portions;
    const suggestedTotal = totalCost * (1 + (toNum(draft.marginPct) || 0) / 100);
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
    if (!draft || saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      await saveInner();
    } catch (e) {
      console.error("save", e);
      setSaveError(`Error inesperado al guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveInner = async () => {
    if (!draft) return;
    if (!draft.name || (draft.items.length === 0 && draft.components.length === 0)) {
      notify("Ponle nombre y al menos un ingrediente o sub-receta");
      return;
    }
    // Antes, las filas sin cantidad se descartaban en silencio al guardar.
    const sinCantidad = draft.items.filter((it) => !(toNum(it.qty) > 0));
    if (sinCantidad.length) {
      const nombres = sinCantidad.map((it) => supplies.find((s) => s.id === it.supplyId)?.name ?? "un elemento").join(", ");
      notify(`Falta la cantidad de: ${nombres}`);
      return;
    }
    if (draft.components.some((c) => !(toNum(c.fraction) > 0))) {
      notify("Falta la proporción de una sub-receta");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user!.id;

    const recipeRow = {
      id: draft.id,
      user_id: userId,
      name: draft.name,
      portions: toNum(draft.portions) || 1,
      labor_hours: toNum(draft.laborHours) || 0,
      labor_rate: toNum(draft.laborRate) || 0,
      indirect_pct: toNum(draft.indirectPct) || 0,
      margin_pct: toNum(draft.marginPct) || 0,
    };

    const { error: recipeError } = await supabase.from("recipes").upsert(recipeRow);
    if (recipeError) { notify("No se pudo guardar la receta"); return; }

    // Primero se insertan las filas nuevas y solo si eso funciona se borran
    // las anteriores. Antes se borraba todo primero y, si la inserción
    // fallaba, la receta quedaba vacía sin ningún aviso.
    const newItems = draft.items
      .filter((it) => it.supplyId && toNum(it.qty) > 0)
      .map((it) => ({ id: uid(), recipe_id: draft.id, supply_id: it.supplyId, qty: toNum(it.qty) }));
    const newComponents = draft.components
      .filter((c) => c.componentRecipeId && toNum(c.fraction) > 0)
      .map((c) => ({ id: uid(), recipe_id: draft.id, component_recipe_id: c.componentRecipeId, fraction: toNum(c.fraction) }));

    if (newItems.length) {
      const { error } = await supabase.from("recipe_supply_items").insert(newItems);
      if (error) {
        console.error("recipe_supply_items insert", error);
        setSaveError(`No se guardaron los ingredientes: ${error.message}${error.code ? ` (código ${error.code})` : ""}`);
        return;
      }
    }
    if (newComponents.length) {
      const { error } = await supabase.from("recipe_components").insert(newComponents);
      if (error) {
        console.error("recipe_components insert", error);
        if (newItems.length) {
          await supabase.from("recipe_supply_items").delete().in("id", newItems.map((r) => r.id));
        }
        setSaveError(`No se guardaron las sub-recetas: ${error.message}${error.code ? ` (código ${error.code})` : ""}`);
        return;
      }
    }

    const keepItemIds = newItems.map((r) => r.id);
    const keepCompIds = newComponents.map((r) => r.id);
    let delItems = supabase.from("recipe_supply_items").delete().eq("recipe_id", draft.id);
    if (keepItemIds.length) delItems = delItems.not("id", "in", `(${keepItemIds.join(",")})`);
    let delComps = supabase.from("recipe_components").delete().eq("recipe_id", draft.id);
    if (keepCompIds.length) delComps = delComps.not("id", "in", `(${keepCompIds.join(",")})`);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([delItems, delComps]);
    if (e1 || e2) {
      console.error("cleanup", e1, e2);
      notify("Receta guardada, pero quedaron líneas viejas. Ábrela y revísala.");
      setDraft(null);
      load();
      return;
    }

    // Verificación: releer de la base de datos lo que quedó guardado.
    const { data: saved, error: readError } = await supabase
      .from("recipe_supply_items").select("id").eq("recipe_id", draft.id);
    const savedCount = saved?.length ?? 0;
    if (readError || savedCount !== newItems.length) {
      console.error("verify", readError, savedCount, newItems.length);
      setSaveError(
        `La receta se guardó, pero al revisarla hay ${savedCount} de ${newItems.length} ingredientes/insumos.` +
          (readError ? ` Error: ${readError.message}` : "") +
          " Toma captura de este mensaje."
      );
      load();
      return;
    }

    notify(`Receta guardada con ${savedCount} ingredientes/insumos`);
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
              <input style={inputStyle} type="text" inputMode="decimal" value={draft.portions} onChange={(e) => setDraft({ ...draft, portions: e.target.value })} />
            </Field>
          </div>
        </Card>

        {(["ingrediente", "insumo"] as const).map((kind) => {
          const isInsumo = kind === "insumo";
          const options = supplies.filter((s) => s.kind === kind);
          // Una fila pertenece a la lista de su tipo; si el insumo/ingrediente
          // ya no existe, se muestra en la lista de ingredientes para poder borrarla.
          const rows = draft.items.filter((it) => {
            const s = supplies.find((x) => x.id === it.supplyId);
            return s ? s.kind === kind : !isInsumo;
          });
          return (
            <Card key={kind}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "#101B33" }}>
                  {isInsumo ? "Insumos y empaque (desechables)" : "Ingredientes"}
                </span>
                <button
                  onClick={() => {
                    if (options.length === 0) {
                      notify(isInsumo ? "Primero agrega tus insumos en la pestaña Insumos" : "Primero agrega tus ingredientes en la pestaña Ingredientes");
                      return;
                    }
                    setDraft({ ...draft, items: [...draft.items, { key: uid(), supplyId: options[0].id, qty: "" }] });
                  }}
                  className="text-xs font-medium flex items-center gap-1" style={{ color: "#1B2A4A" }}
                >
                  <Plus size={13} /> agregar
                </button>
              </div>
              {isInsumo && (
                <p className="text-[11px] mb-2" style={{ color: "#8A7A75" }}>
                  Cajas, fundas, cucharitas, servilletas, etiquetas. Pon cuántas unidades usa esta receta.
                </p>
              )}
              <div className="space-y-2">
                {rows.map((it) => {
                  const supply = supplies.find((s) => s.id === it.supplyId);
                  const qty = toNum(it.qty) || 0;
                  const lineCost = supply ? Number(supply.unit_cost) * qty : 0;
                  return (
                    <div key={it.key}>
                    <div className="flex items-center gap-2">
                      <select
                        style={{ ...inputStyle, flex: 2 }}
                        value={it.supplyId}
                        onChange={(e) => setDraft({ ...draft, items: draft.items.map((x) => x.key === it.key ? { ...x, supplyId: e.target.value } : x) })}
                      >
                        {!supply && <option value={it.supplyId}>(eliminado)</option>}
                        {options.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="text" inputMode="decimal"
                        placeholder={supply ? supply.unit : "cant"}
                        value={it.qty}
                        onChange={(e) => setDraft({ ...draft, items: draft.items.map((x) => x.key === it.key ? { ...x, qty: e.target.value } : x) })}
                      />
                      <button onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.key !== it.key) })} style={{ color: "#B25C5C" }}><Trash2 size={15} /></button>
                    </div>
                    {supply && (
                      <div className="text-[11px] mt-1 pl-1" style={{ fontFamily: "var(--font-plex-mono)", color: qty > 0 ? "#8A7A75" : "#B25C5C" }}>
                        {qty > 0
                          ? `${qty} ${supply.unit} × ${money(supply.unit_cost)}/${supply.unit} = ${money(lineCost)}`
                          : `Escribe la cantidad en ${supply.unit}`}
                      </div>
                    )}
                    </div>
                  );
                })}
                {rows.length === 0 && (
                  <p className="text-xs" style={{ color: "#B0A29C" }}>
                    {isInsumo ? "Sin insumos aún." : "Sin ingredientes aún."}
                  </p>
                )}
              </div>
            </Card>
          );
        })}

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
                  type="text" inputMode="decimal"
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
              <input style={inputStyle} type="text" inputMode="decimal" value={draft.laborHours} onChange={(e) => setDraft({ ...draft, laborHours: e.target.value })} placeholder="2" />
            </Field>
            <Field label="Tarifa por hora (RD$)">
              <input style={inputStyle} type="text" inputMode="decimal" value={draft.laborRate} onChange={(e) => setDraft({ ...draft, laborRate: e.target.value })} placeholder="150" />
            </Field>
            <Field label="Costos indirectos (%)">
              <input style={inputStyle} type="text" inputMode="decimal" value={draft.indirectPct} onChange={(e) => setDraft({ ...draft, indirectPct: e.target.value })} />
            </Field>
            <Field label="Margen de ganancia (%)">
              <input style={inputStyle} type="text" inputMode="decimal" value={draft.marginPct} onChange={(e) => setDraft({ ...draft, marginPct: e.target.value })} />
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

        {saveError && (
          <Card style={{ background: "#F6E3E3", borderColor: "#B25C5C" }}>
            <p className="text-sm font-semibold" style={{ color: "#8A3A3A" }}>No se pudo guardar completo</p>
            <p className="text-xs mt-1" style={{ color: "#8A3A3A" }}>{saveError}</p>
          </Card>
        )}
        <PrimaryButton onClick={save} full>{saving ? "Guardando…" : "Guardar receta"}</PrimaryButton>
        <p className="text-[10px] text-center" style={{ color: "#B0A29C" }}>
          versión {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}
        </p>
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
