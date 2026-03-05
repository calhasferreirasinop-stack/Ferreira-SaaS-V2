import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkColumn() {
    const { data: cols, error } = await supabase.rpc('execute_sql', {
        query: `SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'type_product';`
    });
    console.log("Column stats (via RPC):", JSON.stringify(cols || error, null, 2));

    const { data: rows, error: rowError } = await supabase.from('products').select('*').limit(1);
    console.log("First row raw keys:", Object.keys(rows?.[0] || {}));
}

checkColumn();
