-- 001_initial_schema.sql
-- Ferreira SaaS V2: Base Infrastructure

create extension if not exists "pgcrypto";

-- Companies (Tenants)
create table if not exists public.companies (
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
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  role text default 'user' check (role in ('admin', 'user', 'master')),
  created_at timestamptz default now()
);

-- Subscriptions (Initial)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  plan_id text not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled')),
  created_at timestamptz default now()
);
