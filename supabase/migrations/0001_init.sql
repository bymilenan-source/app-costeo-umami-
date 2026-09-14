-- ============================================================================
-- Costeo UMAMI — esquema inicial (multiusuario, RLS por fila)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfiles (uno por usuaria de auth.users). role='owner' = panel admin (tú).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Mi Emprendimiento',
  tagline text not null default '',
  owner_name text not null default '',
  phone text not null default '',
  email text not null default '',
  instagram text not null default '',
  address text not null default '',
  template text not null default 'recetario',
  monthly_goal numeric not null default 10,
  rnc text not null default '',
  invoice_mode text not null default 'simple' check (invoice_mode in ('simple', 'fiscal')),
  role text not null default 'user' check (role in ('user', 'owner')),
  subscription_status text not null default 'trial' check (subscription_status in ('active', 'expired', 'trial')),
  subscription_paid_at date,
  subscription_due_at date,
  created_at timestamptz not null default now()
);

-- Función security-definer: evita recursión de RLS al consultar el propio rol.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles: ver la propia o si eres admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: editar la propia o si eres admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

create policy "profiles: insertar la propia"
  on public.profiles for insert
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Insumos: ingredientes de comida e insumos/empaque en una sola tabla,
-- distinguidos por "kind" (requisito: mostrarse como líneas de costo separadas).
-- ---------------------------------------------------------------------------
create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingrediente', 'insumo')),
  name text not null,
  unit text not null default 'g',
  purchase_qty numeric not null,
  purchase_cost numeric not null,
  unit_cost numeric generated always as (
    case when purchase_qty > 0 then purchase_cost / purchase_qty else 0 end
  ) stored,
  created_at timestamptz not null default now()
);

alter table public.supplies enable row level security;

create policy "supplies: solo su dueña"
  on public.supplies for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Recetas
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  portions numeric not null default 1,
  labor_hours numeric not null default 0,
  labor_rate numeric not null default 0,
  indirect_pct numeric not null default 10,
  margin_pct numeric not null default 40,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "recipes: solo su dueña"
  on public.recipes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Ingredientes/insumos sueltos usados directamente en una receta.
create table public.recipe_supply_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  supply_id uuid not null references public.supplies(id) on delete restrict,
  qty numeric not null default 0
);

alter table public.recipe_supply_items enable row level security;

create policy "recipe_supply_items: solo su dueña"
  on public.recipe_supply_items for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- Sub-recetas: una receta puede usar otra receta guardada como componente,
-- en una proporción (fraction) de esa sub-receta (ej. 0.25 = 1/4 de la receta).
create table public.recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  component_recipe_id uuid not null references public.recipes(id) on delete restrict,
  fraction numeric not null default 1 check (fraction > 0),
  constraint recipe_components_no_self check (recipe_id <> component_recipe_id)
);

alter table public.recipe_components enable row level security;

create policy "recipe_components: solo su dueña"
  on public.recipe_components for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Pedidos / Facturas
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_phone text not null default '',
  product_name text not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  delivery_date date,
  notes text not null default '',
  deposit numeric not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'abonado', 'pagado')),
  invoice_mode text not null default 'simple' check (invoice_mode in ('simple', 'fiscal')),
  ncf text not null default '',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "orders: solo su dueña"
  on public.orders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Gastos fijos mensuales
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  month text not null, -- 'YYYY-MM'
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "expenses: solo su dueña"
  on public.expenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Solicitudes de suscripción (formulario público de la landing page)
-- ---------------------------------------------------------------------------
create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null default '',
  status text not null default 'pendiente' check (status in ('pendiente', 'contactada', 'convertida', 'descartada')),
  created_at timestamptz not null default now()
);

alter table public.subscription_requests enable row level security;

create policy "subscription_requests: cualquiera puede escribir una"
  on public.subscription_requests for insert
  to anon, authenticated
  with check (true);

create policy "subscription_requests: solo el admin puede leer"
  on public.subscription_requests for select
  using (public.is_admin());

create policy "subscription_requests: solo el admin puede actualizar"
  on public.subscription_requests for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Al crear un usuario en auth.users, crear su fila de perfil automáticamente.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
