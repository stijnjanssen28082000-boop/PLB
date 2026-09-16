-- Minimal stand-ins for the schemas Supabase provides, so the migrations can be
-- run against a plain Postgres in CI. Not part of any real deployment: on a real
-- project auth and storage already exist and these objects are never created.

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- The caller's auth user id. Tests set request.jwt.claim.sub to impersonate.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid
);

alter table storage.objects enable row level security;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end;
$$;
