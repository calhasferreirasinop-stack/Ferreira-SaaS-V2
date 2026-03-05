
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
async function run() {
    const { data: profiles } = await supabase.from('profiles').select('id, name, role').order('created_at', { ascending: false }).limit(2);
    console.log("LAST PROFILES:");
    profiles?.forEach(p => console.log(`- ${p.name}: ${p.role}`));
}
run();
