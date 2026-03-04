import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testUpdate() {
    const id = "da0aa4bc-85dc-4462-8673-62489dad7271"; // Rufo
    console.log("Updating Rufo to 'service'...");

    const { data, error } = await supabase.from('products').update({
        type_product: 'service'
    }).eq('id', id).select();

    if (error) {
        console.error("Update failed:", error.message);
        console.error("Full error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Update success! Result:", JSON.stringify(data, null, 2));
    }
}

testUpdate();
