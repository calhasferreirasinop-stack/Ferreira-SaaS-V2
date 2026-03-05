
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://dembegkbdvlwkyhftwii.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase.rpc('execute_sql', { query: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';" });
    if (error) {
        // If RPC is not available, try a raw query if possible, or just check what tables we have via standard REST
        console.log("RPC Error (expected if not defined):", error);
        // Try to just select from common tables to find the right one
        const tables = ['users', 'profiles', 'accounts', 'user_profiles'];
        for (const t of tables) {
            const { error: te } = await supabase.from(t).select('count').limit(1);
            if (!te) console.log(`Table '${t}' exists.`);
            else console.log(`Table '${t}' error:`, te.message);
        }
    } else {
        console.log("TABLES:", data);
    }
}
listTables();
