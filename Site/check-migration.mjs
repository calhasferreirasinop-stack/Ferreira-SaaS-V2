// Run migration directly via Supabase client (bypasses server)
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import pgPkg from 'pg';
const { Client } = pgPkg;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

// Extract project ref from URL
const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
console.log('Project ref:', projectRef);

async function migrate() {
    // Test current schema
    const { data: sample, error: sampleErr } = await supabase
        .from('products')
        .select('id, name')
        .limit(1);

    console.log('Current products table accessible:', !sampleErr);
    if (sampleErr) console.error('Error:', sampleErr.message);

    // Try to read type_product
    const { data: withType, error: typeErr } = await supabase
        .from('products')
        .select('id, name, type_product')
        .limit(1);

    if (typeErr) {
        console.log('\n❌ Column type_product DOES NOT EXIST yet.');
        console.log('\nPlease run this SQL in your Supabase dashboard SQL Editor:');
        console.log('=====================================');
        console.log(`
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS type_product TEXT NOT NULL DEFAULT 'product';

UPDATE public.products 
  SET type_product = 'product' 
  WHERE type_product IS NULL OR type_product = '';

ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS products_type_product_check;

ALTER TABLE public.products 
  ADD CONSTRAINT products_type_product_check 
  CHECK (type_product IN ('product', 'service'));
`);
        console.log('=====================================');
        console.log('\nAfter running the SQL, the column will work immediately.');
    } else {
        console.log('\n✅ Column type_product EXISTS!');
        console.log('Sample:', withType?.[0]);
    }
}

migrate().catch(console.error);
