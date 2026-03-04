
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkConstraints() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'products';"
    });

    if (error) {
        console.error('Error fetching constraints:', error);
        // Fallback if rpc failed
        const { data: testInsert, error: insertError } = await supabase
            .from('products')
            .insert({
                name: 'TEST_SERVICE_ANTIGRAVITY',
                type_product: 'service',
                company_id: 'd9604efa-eecb-4e93-a118-d1d2715bc8ba' // Using a known company_id from products_structure.txt
            })
            .select();

        if (insertError) {
            console.log('INSERT FAILED:', insertError);
        } else {
            console.log('INSERT SUCCESSFUL:', testInsert);
            // Clean up
            await supabase.from('products').delete().eq('name', 'TEST_SERVICE_ANTIGRAVITY');
        }
        return;
    }

    console.log('Constraints in products table:', data);
}

checkConstraints();
