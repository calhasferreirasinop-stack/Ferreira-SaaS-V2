import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Use POSTGRES_URL se disponível, ou o endpoint do Supabase
// O service_role_key da API REST não permite DDL, mas podemos usar
// o endpoint de queries SQL direto do Supabase via fetch

const SUPABASE_URL = process.env.SUPABASE_URL!.replace('https://', '');
const PROJECT_REF = SUPABASE_URL.split('.')[0]; // ex: dembegkbdvlwkyhftwii
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runSQL(sql: string, name: string) {
    try {
        // Tenta via endpoint SQL direto do Supabase (requer Management API Key)
        // Como não temos, vamos usar o endpoint de query via REST com serviço
        const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/`, {
            method: 'OPTIONS',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            }
        });
        console.log(`Response status: ${res.status}`);
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

// Vamos testar o endpoint de admin para executar SQL
async function main() {
    const sqls = [
        `ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb`,
        `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text`,
        `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text`,
        `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true`,
        `ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz`,
        `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text`,
        `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
    ];

    // Supabase permite executar SQL via o endpoint de admin usando service role
    for (const sql of sqls) {
        const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ query: sql })
        });
        const status = res.status;
        const body = await res.text();
        console.log(`[${status}] ${sql.substring(0, 50)}: ${body.substring(0, 100)}`);
    }
}

main();
