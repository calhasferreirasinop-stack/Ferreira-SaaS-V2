
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testServiceInsert() {
    const { data, error } = await supabase.from('services').insert({
        title: 'TEST_MAKT_SERVICE_ANTIGRAVITY',
        description: 'Testing...',
        company_id: 'd9604efa-eecb-4e93-a118-d1d2715bc8ba'
    }).select();

    if (error) {
        console.log('INSERT IN services TABLE FAILED:', error);
    } else {
        console.log('INSERT IN services TABLE SUCCESSFUL:', data);
        await supabase.from('services').delete().eq('title', 'TEST_MAKT_SERVICE_ANTIGRAVITY');
    }
}

testServiceInsert();
