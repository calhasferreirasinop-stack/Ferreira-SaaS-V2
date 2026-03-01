-- =====================================================
-- FERREIRA SaaS V2 - MIGRATION: Tabelas e Colunas Faltantes
-- Execute este script no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dembegkbdvlwkyhftwii/sql
-- =====================================================

-- 1. Adicionar coluna metadata na tabela activity_logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Criar tabela pix_keys
CREATE TABLE IF NOT EXISTS public.pix_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    label text,
    pix_key text NOT NULL,
    key_type text,
    bank text,
    beneficiary text,
    pix_code text,
    qr_code_url text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pix_keys ENABLE ROW LEVEL SECURITY;

-- 3. Criar tabela settings
CREATE TABLE IF NOT EXISTS public.settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    key text NOT NULL,
    value text,
    created_at timestamptz DEFAULT now()
);

-- Adicionar constraint unique se não existir
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settings_company_key_unique'
    ) THEN
        ALTER TABLE public.settings ADD CONSTRAINT settings_company_key_unique UNIQUE(company_id, key);
    END IF;
END $$;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 4. Criar tabela services
CREATE TABLE IF NOT EXISTS public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    "imageUrl" text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 5. Criar tabela posts
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text,
    "imageUrl" text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 6. Criar tabela gallery
CREATE TABLE IF NOT EXISTS public.gallery (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    "imageUrl" text,
    description text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

-- 7. Criar tabela testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    author text,
    content text,
    rating integer DEFAULT 5,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- 8. Adicionar colunas faltantes na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 9. Adicionar coluna updated_at nos estimates
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 10. Adicionar colunas faltantes em payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 11. Policies de acesso (usando service role, sem RLS constraints)
-- As políticas abaixo são opcionais se você usa service_role_key no servidor

SELECT 'Migration completa! Todas as tabelas e colunas foram criadas.' AS resultado;
