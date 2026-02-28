-- 003_add_subscription_fields.sql
-- Ferreira SaaS V2: Enhanced Subscription Lifecycle

alter table public.subscriptions 
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists external_subscription_id text,
  add column if not exists canceled_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Indices for performance and filtering
create index if not exists idx_subscriptions_company_id on public.subscriptions(company_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
