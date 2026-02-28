-- 004_security_and_rls.sql
-- Ferreira SaaS V2: Optimized RLS Policies and Performance Indices

-- 1. Helper function for optimized company_id lookup
-- Using a stable function to allow PostgreSQL to cache the result within a query
create or replace function public.get_my_company_id()
returns uuid
language sql stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- 2. Indices (Already defined in 002 for business tables, but ensuring others)
create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_subscriptions_company_id on public.subscriptions(company_id);

-- 3. Enable RLS on all multi-tenant tables
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_logs enable row level security;

-- 4. Policies using the optimized helper function

-- Companies: Users can only see/edit their own company
create policy company_access_policy on public.companies
  for all using (id = public.get_my_company_id());

-- Profiles: Users can only see/edit profiles from their company
create policy profile_access_policy on public.profiles
  for all using (company_id = public.get_my_company_id());

-- Subscriptions: Access restricted to company members
create policy subscription_access_policy on public.subscriptions
  for all using (company_id = public.get_my_company_id());

-- Clients: Tenant isolation
create policy client_access_policy on public.clients
  for all using (company_id = public.get_my_company_id());

-- Products: Tenant isolation
create policy product_access_policy on public.products
  for all using (company_id = public.get_my_company_id());

-- Estimates: Tenant isolation
create policy estimate_access_policy on public.estimates
  for all using (company_id = public.get_my_company_id());

-- Estimate Items: Access via parent estimate ownership
create policy estimate_item_access_policy on public.estimate_items
  for all using (
    exists (
      select 1 from public.estimates 
      where id = estimate_items.estimate_id 
      and company_id = public.get_my_company_id()
    )
  );

-- Payments: Tenant isolation
create policy payment_access_policy on public.payments
  for all using (company_id = public.get_my_company_id());

-- Activity Logs: Tenant isolation
create policy log_access_policy on public.activity_logs
  for all using (company_id = public.get_my_company_id());
