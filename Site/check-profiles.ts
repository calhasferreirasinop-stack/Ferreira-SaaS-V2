import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    console.log(JSON.stringify({ profiles, error }, null, 2));

    const { data: companies } = await supabase.from('companies').select('id, name');
    console.log(JSON.stringify({ companies }, null, 2));
}

main().then(() => process.exit(0));
