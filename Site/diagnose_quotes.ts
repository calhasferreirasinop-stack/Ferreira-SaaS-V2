
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentQuotes() {
    const { data: quotes, error } = await supabase
        .from('estimates')
        .select('id, status, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) { console.error(error); return; }

    for (const q of quotes) {
        const { data: ar } = await supabase.from('accounts_receivable').select('id, status').eq('estimate_id', q.id).maybeSingle();
        const { data: po } = await supabase.from('production_orders').select('id, status').eq('estimate_id', q.id).maybeSingle();
        const { count: piCount } = await supabase.from('production_items').select('*', { count: 'exact', head: true }).eq('estimate_id', q.id);

        console.log(`ESTIMATE ${q.id} | Status: ${q.status} | Date: ${q.created_at}`);
        console.log(` -> AR: ${ar ? ar.status : 'None'} | PO: ${po ? po.status : 'None'} | PI Count: ${piCount}`);
    }
}

checkRecentQuotes();
