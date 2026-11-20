import type { Order, OrderItem } from "./types";

type OrderLike = Pick<Order, "product_name" | "quantity" | "unit_price"> & {
  recipe_id?: string | null;
  items?: OrderItem[] | null;
};

/** Productos del pedido. Los pedidos viejos (sin `items`) se leen de las columnas sueltas. */
export function orderItems(o: OrderLike): OrderItem[] {
  if (Array.isArray(o.items) && o.items.length > 0) return o.items;
  return [{
    product_name: o.product_name,
    recipe_id: o.recipe_id ?? null,
    quantity: Number(o.quantity) || 0,
    unit_price: Number(o.unit_price) || 0,
  }];
}

export const itemTotal = (it: OrderItem) => (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);

export function orderTotal(o: OrderLike): number {
  return orderItems(o).reduce((s, it) => s + itemTotal(it), 0);
}

/** Texto corto para listas, notificaciones y calendario: "Croquetas x12, Bizcocho x1". */
export function itemsSummary(items: OrderItem[]): string {
  return items.map((it) => `${it.product_name} x${it.quantity}`).join(", ");
}
