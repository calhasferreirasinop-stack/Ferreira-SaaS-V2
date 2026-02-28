-- 002_add_business_entities.sql
-- Ferreira SaaS V2: Business Core Entities

-- Clients
create table if not exists public.clients (
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
create table if not exists public.products (
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
create table if not exists public.estimates (
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
create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references public.estimates(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total_price numeric not null default 0
);

-- Payments
create table if not exists public.payments (
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
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  created_at timestamptz default now()
);
