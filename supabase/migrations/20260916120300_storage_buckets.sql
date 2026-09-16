-- docs/datamodel.md §5 — all buckets private. Access only through signed URLs
-- with a short lifetime; never a public URL. The path always starts with the
-- organization id so a storage policy can check tenancy from the path itself.

insert into storage.buckets (id, name, public)
values
  ('photos', 'photos', false),
  ('signatures', 'signatures', false),
  ('reports', 'reports', false),
  ('logos', 'logos', false)
on conflict (id) do nothing;

-- The first path segment is the organization id: {organization_id}/{inspection_id}/{file}
create or replace function storage_path_belongs_to_caller(object_name text)
returns boolean
language sql
stable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid = current_app_user_org();
$$;

create policy "tenant reads own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('photos', 'signatures', 'reports', 'logos')
    and storage_path_belongs_to_caller(name)
  );

-- Inspectors upload photos and signatures. Reports are written by an edge
-- function with the service role, so they are deliberately not in this list.
create policy "tenant uploads own evidence" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('photos', 'signatures', 'logos')
    and storage_path_belongs_to_caller(name)
  );

-- A photo can be replaced while the inspection is still open (retry after a
-- failed upload); the locking trigger on the photos row governs whether that is
-- still allowed at all.
create policy "tenant updates own uploads" on storage.objects
  for update to authenticated
  using (bucket_id in ('photos', 'logos') and storage_path_belongs_to_caller(name))
  with check (bucket_id in ('photos', 'logos') and storage_path_belongs_to_caller(name));
