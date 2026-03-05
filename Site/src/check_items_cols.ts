
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkEstimateItemsCols() {
    const { data, error } = await supabase.from('estimate_items').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns in estimate_items table:', Object.keys(data[0]));
    } else {
        // If empty, try to get from rpc if available or just assume what usually exists
        console.log('Empty estimate_items table.');
    }
}

checkEstimateItemsCols();
