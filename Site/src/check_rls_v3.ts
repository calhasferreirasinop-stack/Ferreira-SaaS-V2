
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkRLS() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND (tablename = 'products' OR tablename = 'services');"
    });

    if (error) {
        console.error('Error fetching RLS policies:', error);
        return;
    }

    console.log('RLS Policies:', data);
}

checkRLS();
