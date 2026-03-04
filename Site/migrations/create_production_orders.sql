-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: create_production_orders
-- Execute no Supabase SQL Editor: https://app.supabase.com
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS production_orders (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_origin_id UUID NOT NULL,
    company_target_id UUID NOT NULL,
    estimate_id       UUID NOT NULL UNIQUE,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','in_production','ready','delivered')),
    total_metros      NUMERIC(10,4) DEFAULT 0,
    total_valor       NUMERIC(10,2) DEFAULT 0,
    notes             TEXT,
    client_name       TEXT,
    origin_name       TEXT,
    target_name       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prod_orders_origin  ON production_orders(company_origin_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_target  ON production_orders(company_target_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_status  ON production_orders(status);

-- RLS: desabilitado para que o server.ts (service role) controle o acesso
ALTER TABLE production_orders DISABLE ROW LEVEL SECURITY;
