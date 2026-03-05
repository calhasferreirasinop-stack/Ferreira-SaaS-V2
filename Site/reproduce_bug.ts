
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reproduce() {
    // 1. Create a quote
    const { data: quote, error: e1 } = await supabase.from('estimates').insert({
        company_id: 'cde628db-a831-4f01-83fb-980757d901a1',
        status: 'pending',
        total_amount: 100,
        final_amount: 100
    }).select().single();

    if (e1) { console.error('E1', e1); return; }
    console.log('Created quote:', quote.id);

    // 2. Mock visiting fabrication screen (creates PO)
    const { data: po, error: e2 } = await supabase.from('production_orders').insert({
        estimate_id: quote.id,
        company_origin_id: quote.company_id,
        company_target_id: quote.company_id,
        status: 'in_production',
        client_name: 'Test'
    }).select().single();

    if (e2) { console.error('E2', e2); return; }
    console.log('Created PO:', po.id);

    // 3. Try to update the quote (simulate the bug)
    // We can't really call the API here easily without auth, but we can check what the logic WOULD do.

    const { data: currentEstimate } = await supabase.from('estimates').select('status').eq('id', quote.id).single();
    const { data: existingAR } = await supabase.from('accounts_receivable').select('id').eq('estimate_id', quote.id).maybeSingle();
    const { data: existingPO } = await supabase.from('production_orders').select('id').eq('estimate_id', quote.id).maybeSingle();

    const isEditRestrictedStatus = ['approved', 'partial', 'paid', 'in_production', 'canceled', 'expired'].includes(currentEstimate?.status || '');

    if (isEditRestrictedStatus || existingAR || existingPO) {
        console.log('BUG REPRODUCED: Save is blocked!');
    } else {
        console.log('Save is NOT blocked.');
    }

    // Cleanup
    await supabase.from('production_orders').delete().eq('id', po.id);
    await supabase.from('estimates').delete().eq('id', quote.id);
}

reproduce();
