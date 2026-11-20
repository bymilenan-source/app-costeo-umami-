-- ============================================================================
-- Varios productos en un mismo pedido / factura.
-- Cada pedido guarda su lista de productos en `items` (JSON):
--   [{ "product_name": "...", "recipe_id": "...|null", "quantity": 1, "unit_price": 0 }]
-- Las columnas antiguas (product_name, quantity, unit_price, recipe_id) se
-- siguen llenando con un resumen (quantity = 1, unit_price = total) para que
-- los pedidos viejos y los cálculos existentes sigan funcionando.
-- ============================================================================

alter table public.orders
  add column if not exists items jsonb not null default '[]'::jsonb;
