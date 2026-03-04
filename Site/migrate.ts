import dotenv from 'dotenv';
dotenv.config();

// Use Supabase Management API to run SQL 
// The project ID is embedded in the URL: https://dembegkbdvlwkyhftwii.supabase.co
const PROJECT_REF = 'dembegkbdvlwkyhftwii';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        });
        const body = await res.text();
        if (!res.ok) return { ok: false, error: body };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

const migrations = [
    { name: 'activity_logs.metadata', sql: `ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb;` },
    {
        name: 'pix_keys table', sql: `
        CREATE TABLE IF NOT EXISTS public.pix_keys (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            label text, pix_key text NOT NULL, key_type text, bank text, beneficiary text,
            pix_code text, qr_code_url text, sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now()
        );`
    },
    {
        name: 'settings table', sql: `
        CREATE TABLE IF NOT EXISTS public.settings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            key text NOT NULL, value text, created_at timestamptz DEFAULT now()
        );`
    },
    {
        name: 'settings unique constraint', sql: `
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_company_key_unique') THEN
                ALTER TABLE public.settings ADD CONSTRAINT settings_company_key_unique UNIQUE(company_id, key);
            END IF;
        END $$;`
    },
    {
        name: 'services table', sql: `
        CREATE TABLE IF NOT EXISTS public.services (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            title text NOT NULL, description text, "imageUrl" text, created_at timestamptz DEFAULT now()
        );`
    },
    {
        name: 'posts table', sql: `
        CREATE TABLE IF NOT EXISTS public.posts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            title text NOT NULL, content text, "imageUrl" text, created_at timestamptz DEFAULT now()
        );`
    },
    {
        name: 'gallery table', sql: `
        CREATE TABLE IF NOT EXISTS public.gallery (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
            "imageUrl" text, description text, created_at timestamptz DEFAULT now()
        );`
    },
    {
        name: 'testimonials table', sql: `
        CREATE TABLE IF NOT EXISTS public.testimonials (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
            author text, content text, rating integer DEFAULT 5, created_at timestamptz DEFAULT now()
        );`
    },
    { name: 'profiles.username', sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;` },
    { name: 'profiles.password', sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;` },
    { name: 'profiles.active', sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;` },
    { name: 'profiles.phone', sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;` },
    { name: 'profiles.email', sql: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;` },
    { name: 'estimates.updated_at', sql: `ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz;` },
    { name: 'payments.payment_method', sql: `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text;` },
    { name: 'payments.paid_at', sql: `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;` },
];

async function main() {
    console.log(`Running ${migrations.length} migrations...\n`);
    for (const m of migrations) {
        const r = await runSQL(m.sql);
        console.log(r.ok ? `✓ ${m.name}` : `✗ ${m.name}: ${r.error?.substring(0, 100)}`);
    }
    console.log('\nMigration complete!');
}

main();
