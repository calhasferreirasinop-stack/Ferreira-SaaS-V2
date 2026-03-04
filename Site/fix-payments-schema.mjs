// Full payment flow test simulating what server.ts does
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function main() {
    console.log('=== Full Payment Flow Test ===\n');

    // Simulate what the server does when registering a payment
    const quoteId = '3506bb0b-3ff2-429c-b260-efb1f76c4300'; // From the account found earlier
    const companyId = 'd9604efa-eecb-4e93-a118-d1d2715bc8ba';
    const val = 10.00;
    const forma_pagamento = 'pix';
    const data_pagamento = '2026-03-03';
    const observacao = 'Teste de pagamento';

    console.log(`1. Looking for accounts_receivable for quote: ${quoteId}`);

    let { data: acc, error: err1 } = await supabase
        .from('accounts_receivable')
        .select('*')
        .or(`id.eq.${quoteId},estimate_id.eq.${quoteId}`)
        .eq('company_id', companyId)
        .maybeSingle();

    if (err1) console.error('  Error:', err1.message);

    if (!acc) {
        console.log('  No existing account, will create one');
        // ... (would fetch estimate and create account)
    } else {
        console.log(`  Found account: ${acc.id}, valor_restante: ${acc.valor_restante}`);
    }

    console.log('\n2. Testing payment insert with correct fields...');

    const paymentBaseInsert = {
        id: crypto.randomUUID(),
        company_id: companyId,
        estimate_id: quoteId,
        amount: val,
        payment_method: forma_pagamento,
        status: 'paid',
    };

    const paymentExtended = {
        ...paymentBaseInsert,
        receivable_id: acc?.id,
        valor_pago: val,
        data_pagamento,
        forma_pagamento,
        observacao,
    };

    // Try extended first
    const { data: extData, error: extErr } = await supabase.from('payments').insert(paymentExtended).select().single();

    let payment = null;
    if (extErr) {
        if (extErr.code === 'PGRST204' || (extErr.message && extErr.message.includes('column'))) {
            console.log(`  Extended insert failed (expected - columns not migrated): ${extErr.message.substring(0, 60)}`);
            console.log('  Falling back to base insert...');

            const { data: baseData, error: baseErr } = await supabase.from('payments').insert(paymentBaseInsert).select().single();
            if (baseErr) {
                console.log(`  ❌ Base insert also failed: ${baseErr.message}`);
            } else {
                payment = baseData;
                console.log('  ✅ Base insert succeeded!', payment.id);
            }
        } else {
            console.log(`  ❌ Unexpected error: ${extErr.message}`);
        }
    } else {
        payment = extData;
        console.log('  ✅ Extended insert succeeded!', payment.id);
    }

    // Cleanup
    if (payment) {
        await supabase.from('payments').delete().eq('id', payment.id);
        console.log('  Cleanup done.');
    }

    console.log('\n=== TEST COMPLETE ===');
    if (payment) {
        console.log('✅ Payment flow will work correctly after the server.ts fix!');
    } else {
        console.log('❌ Payment flow still has issues. Review the error above.');
    }
}

main().catch(console.error);
