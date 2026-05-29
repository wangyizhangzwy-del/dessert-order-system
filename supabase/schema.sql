-- Supabase schema for dessert-order-system.
-- Run this in Supabase → SQL Editor before deploying with NEXT_PUBLIC_DATA_BACKEND=supabase.
-- All access goes through Next.js server routes using the service_role key.
-- RLS is enabled with no public policies, so the public/anon key cannot read or write.

create extension if not exists pgcrypto;

-- Historical 接龙 (source of truth for orders).
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  batch_id text unique not null,
  batch_name text,
  order_date text,
  total_amount numeric not null default 0,
  warning_count integer not null default 0,
  failed_count integer not null default 0,
  ignore_example_order boolean not null default true,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists batches_order_date_idx on public.batches (order_date);
create index if not exists batches_updated_at_idx on public.batches (updated_at desc);

-- Customers (profile fields + denormalized order history).
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  wechat_id text unique not null,
  phone text,
  default_address text,
  default_delivery_method text,
  balance numeric not null default 0,
  notes text,
  order_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single shared app settings row.
create table if not exists public.app_settings (
  id integer primary key default 1,
  settings jsonb not null default '{"ignoreExampleOrder": true}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Single shared in-progress draft (synced across devices, last-write-wins).
create table if not exists public.app_draft (
  id integer primary key default 1,
  payload jsonb,
  updated_at timestamptz not null default now(),
  constraint app_draft_single_row check (id = 1)
);
insert into public.app_draft (id) values (1) on conflict (id) do nothing;

-- Lock down: enable RLS with no public policies. Only the service_role (server) can access.
alter table public.batches enable row level security;
alter table public.customers enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_draft enable row level security;
