
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkQuotesCols() {
    const { data, error } = await supabase.from('quotes').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns in quotes table:', Object.keys(data[0]));
    } else {
        console.log('Empty quotes table.');
    }
}

checkQuotesCols();
