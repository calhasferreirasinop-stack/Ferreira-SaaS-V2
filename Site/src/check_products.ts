import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    const output = error ? `Error: ${error.message}` : JSON.stringify(data[0] || {}, null, 2);
    fs.writeFileSync('products_structure.txt', output);
}

check();
