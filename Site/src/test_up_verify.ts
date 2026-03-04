import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testUpdateVerify() {
    console.log("Updating Limpeza to service...");
    const { data: up, error: ue } = await supabase
        .from('products')
        .update({ type_product: 'service' })
        .eq('name', 'Limpeza')
        .select();

    console.log("Update success?", !ue);
    console.log("Updated row:", JSON.stringify(up?.[0], null, 2));

    console.log("Querying back Limpeza...");
    const { data: sel } = await supabase.from('products').select('*').eq('name', 'Limpeza');
    console.log("Queried row:", JSON.stringify(sel?.[0], null, 2));
}

testUpdateVerify();
