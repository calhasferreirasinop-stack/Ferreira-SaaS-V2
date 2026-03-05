import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function updateTest() {
    const { data, error } = await supabase
        .from('products')
        .update({ type_product: 'service' })
        .eq('name', 'Teste Servi')
        .select();

    console.log("Update Error:", error);
    console.log("Update Data:", JSON.stringify(data, null, 2));
}

updateTest();
