export type InvoiceMode = "simple" | "fiscal";
export type SubscriptionStatus = "active" | "expired" | "trial";
export type OrderStatus = "pendiente" | "abonado" | "pagado";
export type SupplyKind = "ingrediente" | "insumo";
export type Role = "user" | "owner";
export type RequestStatus = "pendiente" | "contactada" | "convertida" | "descartada";

export interface Profile {
  id: string;
  business_name: string;
  tagline: string;
  owner_name: string;
  phone: string;
  email: string;
  instagram: string;
  address: string;
  template: string;
  monthly_goal: number;
  logo_url: string;
  rnc: string;
  invoice_mode: InvoiceMode;
  role: Role;
  subscription_status: SubscriptionStatus;
  subscription_paid_at: string | null;
  subscription_due_at: string | null;
  created_at: string;
}

export interface Supply {
  id: string;
  user_id: string;
  kind: SupplyKind;
  name: string;
  unit: string;
  purchase_qty: number;
  purchase_cost: number;
  unit_cost: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  portions: number;
  labor_hours: number;
  labor_rate: number;
  indirect_pct: number;
  margin_pct: number;
  created_at: string;
}

export interface RecipeSupplyItem {
  id: string;
  recipe_id: string;
  supply_id: string;
  qty: number;
}

export interface RecipeComponent {
  id: string;
  recipe_id: string;
  component_recipe_id: string;
  fraction: number;
}

export interface Order {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string;
  product_name: string;
  recipe_id: string | null;
  quantity: number;
  unit_price: number;
  delivery_date: string | null;
  notes: string;
  deposit: number;
  status: OrderStatus;
  invoice_mode: InvoiceMode;
  ncf: string;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  month: string;
  created_at: string;
}

export interface SubscriptionRequest {
  id: string;
  name: string;
  contact: string;
  message: string;
  status: RequestStatus;
  created_at: string;
}

// Tipo mínimo compatible con el genérico de @supabase/ssr.
// (No generamos el tipo completo de supabase-cli para mantener esto simple;
// las consultas usan estas interfaces directamente vía `as`.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
