-- ============================================================================
-- Notificaciones push: suscripciones por usuaria + control de envío diario.
-- ============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: cada quien administra las suyas"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Evita reenviar el mismo aviso de un pedido más de una vez el mismo día.
alter table public.orders
  add column if not exists last_notified_on date;
