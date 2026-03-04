import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: profiles } = await supabase.from('profiles').select('*').limit(3);
    if (!profiles?.length) { console.log('No profiles'); return; }

    const cols = Object.keys(profiles[0]);
    console.log('Columns:', cols.join(', '));
    const hasUsername = cols.includes('username');
    const hasActive = cols.includes('active');
    console.log(`Has username: ${hasUsername}, Has active: ${hasActive}`);

    if (hasUsername) {
        // Set username and active for existing profiles
        for (const p of profiles) {
            const { error } = await supabase.from('profiles')
                .update({ username: 'admin', active: true })
                .eq('id', p.id);
            console.log(error ? `✗ ${error.message}` : `✓ Updated profile ${p.id}`);
        }
    }
}

main().then(() => process.exit(0));
