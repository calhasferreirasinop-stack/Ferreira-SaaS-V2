import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test(name: string, fn: () => Promise<any>) {
    const { data, error } = await fn();
    console.log(error ? `✗ ${name}: ${error.message}` : `✓ ${name}`);
}

async function main() {
    console.log('=== Schema Status Check ===\n');

    const tables = ['estimate_items', 'pix_keys', 'settings', 'services', 'posts', 'gallery', 'testimonials', 'payments', 'activity_logs', 'profiles'];

    for (const t of tables) {
        const { error } = await supabase.from(t).select('*').limit(1);
        console.log(error ? `✗ ${t}: ${error.message}` : `✓ ${t}`);
    }

    console.log('\n=== Column Checks ===\n');

    const cols = [
        ['estimate_items', 'metadata'],
        ['activity_logs', 'metadata'],
        ['profiles', 'username'],
        ['profiles', 'password'],
        ['profiles', 'active'],
        ['estimates', 'updated_at'],
        ['payments', 'payment_method'],
        ['payments', 'paid_at'],
    ];

    for (const [t, c] of cols) {
        const { error } = await supabase.from(t).select(c).limit(1);
        console.log(error ? `✗ ${t}.${c}: ${error.message}` : `✓ ${t}.${c}`);
    }
}

main();
