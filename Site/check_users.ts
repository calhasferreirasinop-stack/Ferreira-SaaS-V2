
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://dembegkbdvlwkyhftwii.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('users').select('*').limit(3);
    if (error) {
        console.error("ERROR:", error);
    } else {
        console.log("USERS:", data);
    }
}
check();
