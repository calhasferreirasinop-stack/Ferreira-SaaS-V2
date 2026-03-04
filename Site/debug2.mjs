import "dotenv/config.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    // using a dummy valid UUID just to check table existence
    const cId = 'd9604efa-eecb-4e93-a118-d1d2715bc8ba';
    const results = await Promise.all([
        supabase.from('companies').select('settings').eq('id', cId).limit(1),
        supabase.from('services').select('id').eq('company_id', cId).limit(1),
        supabase.from('posts').select('id').eq('company_id', cId).limit(1),
        supabase.from('gallery').select('id').eq('company_id', cId).limit(1),
        supabase.from('testimonials').select('id').eq('company_id', cId).limit(1),
        supabase.from('estimates').select('id').eq('company_id', cId).limit(1),
        supabase.from('products').select('id').eq('company_id', cId).limit(1)
    ]);

    const names = ['companies', 'services', 'posts', 'gallery', 'testimonials', 'estimates', 'products'];
    results.forEach((r, i) => {
        if (r.error) console.log(`${names[i]} ERRO:`, r.error.message);
        else console.log(`${names[i]} OK`);
    });
}
test();
