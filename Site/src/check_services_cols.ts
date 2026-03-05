
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkServicesTable() {
    const { data, error } = await supabase.from('services').select('*').limit(1);
    if (error) {
        console.error('Error fetching services:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in services table:', Object.keys(data[0]));
    } else {
        console.log('Services table is empty.');
    }
}

checkServicesTable();
