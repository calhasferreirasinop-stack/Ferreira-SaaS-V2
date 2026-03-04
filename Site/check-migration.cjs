// Run migration check - CommonJS compatible
const dotenv = require('dotenv');
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function migrate() {
    // Try to read type_product
    const { data: withType, error: typeErr } = await supabase
        .from('products')
        .select('id, name, type_product')
        .limit(1);

    if (typeErr) {
        console.log('❌ Column type_product DOES NOT EXIST yet.');
        console.log('Error:', typeErr.message);
        console.log('\nSQL to run in Supabase dashboard:');
        console.log(`
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type_product TEXT NOT NULL DEFAULT 'product';
UPDATE public.products SET type_product = 'product' WHERE type_product IS NULL;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_product_check;
ALTER TABLE public.products ADD CONSTRAINT products_type_product_check CHECK (type_product IN ('product', 'service'));
`);
    } else {
        console.log('✅ Column type_product EXISTS!');
        console.log('Sample:', JSON.stringify(withType?.[0] || {}));
    }
}

migrate().catch(console.error);
