
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkColumns() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in products table:', Object.keys(data[0]));
    } else {
        console.log('Products table is empty, cannot easily check columns via select *');
    }
}

checkColumns();
