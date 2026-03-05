
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkAllPossibleColumns() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        // If no data, try to query information_schema if possible (though rpc usually fails)
        console.log('No data found in products table.');
    }
}

checkAllPossibleColumns();
