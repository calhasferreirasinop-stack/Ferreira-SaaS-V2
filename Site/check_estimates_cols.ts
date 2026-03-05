import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data, error } = await supabase.from('estimates').select('*').limit(1);
    if (error) {
        console.error('Error fetching estimates:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns in estimates table:', Object.keys(data[0]));
    } else {
        console.log('No data in estimates table to check columns.');
    }
}

main();
