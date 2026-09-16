-- ============================================================================
-- Logo del negocio: columna en profiles + bucket de Storage para las imágenes.
-- ============================================================================

alter table public.profiles
  add column if not exists logo_url text not null default '';

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos: cada quien sube a su propia carpeta"
  on storage.objects for insert
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: cada quien reemplaza lo suyo"
  on storage.objects for update
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "logos: cada quien borra lo suyo"
  on storage.objects for delete
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
