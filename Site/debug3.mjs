import 'dotenv/config.js';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('Profiles:', JSON.stringify((await sb.from('profiles').select('*')).data, null, 2));
    console.log('Companies:', JSON.stringify((await sb.from('companies').select('*')).data, null, 2));
}
run();
