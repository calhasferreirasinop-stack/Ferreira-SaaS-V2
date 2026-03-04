import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    console.log("Testing estimate_items select('metadata') ...");
    const { data, error } = await supabase.from('estimate_items').select('metadata').limit(1);
    if (error) {
        console.error("SELECT metadata failed:", error.message);
    } else {
        console.log("SELECT metadata success!");
    }
}

test();
