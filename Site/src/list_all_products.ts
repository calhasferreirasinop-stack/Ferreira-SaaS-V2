import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkAll() {
    const { data, error } = await supabase.from('products').select('id, name, type_product');
    console.log("All products:", JSON.stringify(data, null, 2));
}

checkAll();
