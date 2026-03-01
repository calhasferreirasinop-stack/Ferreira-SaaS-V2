# INSTRUÇÕES DE MIGRATION DO BANCO DE DADOS

## Problema
O banco de dados Supabase V2 está faltando algumas tabelas e colunas que o sistema precisa.

## Como Corrigir

1. Acesse o SQL Editor do Supabase:
   https://supabase.com/dashboard/project/dembegkbdvlwkyhftwii/sql/new

2. Copie e execute o SQL abaixo:

```sql
-- ================================================
-- MIGRATION: Adicionar colunas e tabelas faltantes
-- ================================================

-- 1. Colunas em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Coluna updated_at em estimates
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 3. Colunas em payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 4. Coluna metadata em activity_logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 5. Tabela pix_keys
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

-- 6. Tabela settings
CREATE TABLE IF NOT EXISTS public.settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    key text NOT NULL,
    value text,
    created_at timestamptz DEFAULT now()
);

-- 7. Tabela services
CREATE TABLE IF NOT EXISTS public.services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    "imageUrl" text,
    created_at timestamptz DEFAULT now()
);

-- 8. Tabela posts
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text,
    "imageUrl" text,
    created_at timestamptz DEFAULT now()
);

-- 9. Tabela gallery
CREATE TABLE IF NOT EXISTS public.gallery (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    "imageUrl" text,
    description text,
    created_at timestamptz DEFAULT now()
);

-- 10. Tabela testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    author text,
    content text,
    rating integer DEFAULT 5,
    created_at timestamptz DEFAULT now()
);

-- 11. Atualizar o admin existente (substitua <profile_id> pelo ID real)
-- Depois da migration, chame: POST http://localhost:3000/api/setup
-- com body: {"secret":"ferreira-setup-2024"}

SELECT 'Migration executada com sucesso!' AS resultado;
```

3. Após executar o SQL, chame o endpoint de setup:
   POST http://localhost:3000/api/setup
   Body: {"secret":"ferreira-setup-2024"}

   Isso vai criar/atualizar o usuário admin com login: admin / admin123
