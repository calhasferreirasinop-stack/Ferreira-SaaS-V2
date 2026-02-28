-- FERREIRA SAAS V2 - BASE ARCHITECTURE
-- This script creates the multi-tenant SaaS structure with RLS and indices.

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. TABLES

-- Companies (Tenants)
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  cnpj text,
  email text,
  phone text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Profiles (User extension)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  role text default 'user' check (role in ('admin', 'user', 'master')),
  created_at timestamptz default now()
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  plan_id text not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  external_subscription_id text,
  created_at timestamptz default now()
);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  document text,
  address text,
  created_at timestamptz default now()
);

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  description text,
  unit text,
  base_cost numeric default 0,
  default_margin_percentage numeric default 0,
  calculated_price numeric default 0,
  stock_quantity numeric default 0,
  category text,
  created_at timestamptz default now()
);

-- Estimates
create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  status text default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'completed')),
  total_amount numeric default 0,
  discount_amount numeric default 0,
  final_amount numeric default 0,
  profit_amount numeric default 0,
  profit_margin_percentage numeric default 0,
  notes text,
  created_at timestamptz default now()
);

-- Estimate Items
create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total_price numeric not null default 0
);

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  amount numeric not null default 0,
  method text check (method in ('pix', 'card', 'cash', 'transfer')),
  status text default 'pending' check (status in ('pending', 'paid', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Activity Logs
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz default now()
);

-- 3. INDICES
create index idx_profiles_company_id on public.profiles(company_id);
create index idx_subscriptions_company_id on public.subscriptions(company_id);
create index idx_clients_company_id on public.clients(company_id);
create index idx_products_company_id on public.products(company_id);
create index idx_estimates_company_id on public.estimates(company_id);
create index idx_payments_company_id on public.payments(company_id);
create index idx_activity_logs_company_id on public.activity_logs(company_id);
create index idx_estimates_client_id on public.estimates(client_id);
create index idx_estimate_items_estimate_id on public.estimate_items(estimate_id);

-- 4. RLS POLICIES

-- Enable RLS for all tables
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;

-- Policies for public.companies (User can only see their own company)
create policy company_access_policy on public.companies
  for all using (
    id in (select company_id from public.profiles where id = auth.uid())
  );

-- Policies for all other tables (Filter by company_id)
create policy profile_access_policy on public.profiles
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy subscription_access_policy on public.subscriptions
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy client_access_policy on public.clients
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy product_access_policy on public.products
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy estimate_access_policy on public.estimates
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy estimate_item_access_policy on public.estimate_items
  for all using (
    estimate_id in (
      select id from public.estimates where company_id in (
        select company_id from public.profiles where id = auth.uid()
      )
    )
  );

create policy payment_access_policy on public.payments
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

create policy log_access_policy on public.activity_logs
  for all using (company_id in (select company_id from public.profiles where id = auth.uid()));

-- 5. FUNCTION TO AUTO-CREATE PROFILE ON SIGNUP (Optional but recommended)
-- This requires careful manual setup in Supabase dashboard to link the first user to a company.
-- For now, the app should handle profile creation post-signup.
