import type { Recipe, RecipeComponent, RecipeSupplyItem, Supply } from "@/lib/types";

export interface RecipeGraph {
  recipes: Record<string, Recipe>;
  supplyItemsByRecipe: Record<string, RecipeSupplyItem[]>;
  componentsByRecipe: Record<string, RecipeComponent[]>;
  supplies: Record<string, Supply>;
}

export interface SubRecipeContribution {
  componentRecipeId: string;
  name: string;
  fraction: number;
  cost: number;
}

export interface RecipeCostBreakdown {
  ingredientCost: number;
  insumoCost: number;
  subRecipeCost: number;
  subRecipeDetails: SubRecipeContribution[];
  laborCost: number;
  subtotal: number;
  indirectCost: number;
  totalCost: number;
  costPerPortion: number;
  suggestedTotal: number;
  pricePerPortion: number;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Calcula el costo de una receta de forma recursiva, resolviendo sub-recetas
 * como fracción del costo total de la receta componente. Lanza un error si
 * detecta un ciclo (una receta que termina dependiendo de sí misma).
 */
export function computeRecipeCost(
  recipeId: string,
  graph: RecipeGraph,
  stack: string[] = []
): RecipeCostBreakdown {
  if (stack.includes(recipeId)) {
    const cycle = [...stack, recipeId].map((id) => graph.recipes[id]?.name ?? id).join(" → ");
    throw new Error(`Ciclo de sub-recetas detectado: ${cycle}`);
  }
  const recipe = graph.recipes[recipeId];
  if (!recipe) {
    throw new Error("Receta no encontrada");
  }

  const nextStack = [...stack, recipeId];

  const supplyItems = graph.supplyItemsByRecipe[recipeId] ?? [];
  let ingredientCost = 0;
  let insumoCost = 0;
  for (const item of supplyItems) {
    const supply = graph.supplies[item.supply_id];
    if (!supply) continue;
    const cost = num(supply.unit_cost) * num(item.qty);
    if (supply.kind === "insumo") insumoCost += cost;
    else ingredientCost += cost;
  }

  const components = graph.componentsByRecipe[recipeId] ?? [];
  const subRecipeDetails: SubRecipeContribution[] = components.map((comp) => {
    const sub = computeRecipeCost(comp.component_recipe_id, graph, nextStack);
    const fraction = num(comp.fraction);
    return {
      componentRecipeId: comp.component_recipe_id,
      name: graph.recipes[comp.component_recipe_id]?.name ?? "Sub-receta",
      fraction,
      cost: sub.totalCost * fraction,
    };
  });
  const subRecipeCost = subRecipeDetails.reduce((s, d) => s + d.cost, 0);

  const laborCost = num(recipe.labor_hours) * num(recipe.labor_rate);
  const subtotal = ingredientCost + insumoCost + subRecipeCost + laborCost;
  const indirectCost = subtotal * (num(recipe.indirect_pct) / 100);
  const totalCost = subtotal + indirectCost;
  const portions = num(recipe.portions) || 1;
  const costPerPortion = totalCost / portions;
  const suggestedTotal = totalCost * (1 + num(recipe.margin_pct) / 100);
  const pricePerPortion = suggestedTotal / portions;

  return {
    ingredientCost,
    insumoCost,
    subRecipeCost,
    subRecipeDetails,
    laborCost,
    subtotal,
    indirectCost,
    totalCost,
    costPerPortion,
    suggestedTotal,
    pricePerPortion,
  };
}

/**
 * True si usar `candidateComponentId` como componente de `recipeId` crearía
 * un ciclo (porque candidateComponentId ya depende, directa o
 * indirectamente, de recipeId). Se usa para validar el formulario antes de
 * guardar.
 */
export function wouldCreateCycle(
  graph: RecipeGraph,
  recipeId: string,
  candidateComponentId: string
): boolean {
  if (recipeId === candidateComponentId) return true;
  const seen = new Set<string>();
  const stack = [candidateComponentId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === recipeId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const comps = graph.componentsByRecipe[current] ?? [];
    for (const c of comps) stack.push(c.component_recipe_id);
  }
  return false;
}

export function buildRecipeGraph(
  recipes: Recipe[],
  supplyItems: RecipeSupplyItem[],
  components: RecipeComponent[],
  supplies: Supply[]
): RecipeGraph {
  const graph: RecipeGraph = {
    recipes: Object.fromEntries(recipes.map((r) => [r.id, r])),
    supplyItemsByRecipe: {},
    componentsByRecipe: {},
    supplies: Object.fromEntries(supplies.map((s) => [s.id, s])),
  };
  for (const item of supplyItems) {
    (graph.supplyItemsByRecipe[item.recipe_id] ??= []).push(item);
  }
  for (const comp of components) {
    (graph.componentsByRecipe[comp.recipe_id] ??= []).push(comp);
  }
  return graph;
}

export const money = (n: unknown) =>
  `RD$${num(n).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
