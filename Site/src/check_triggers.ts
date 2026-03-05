import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkTriggers() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: `SELECT trigger_name, event_manipulation, event_object_table, action_statement
                FROM information_schema.triggers
                WHERE event_object_table = 'products';`
    });
    console.log("Triggers:", JSON.stringify(data || error, null, 2));
}

checkTriggers();
