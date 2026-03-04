import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // List users in Supabase Auth
    const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) {
        console.log('Auth users error:', authErr.message);
    } else {
        console.log('Auth users:');
        authUsers.users.forEach(u => {
            console.log(` - ID: ${u.id}, email: ${u.email}, created: ${u.created_at}`);
        });
    }

    // List profiles
    const { data: profiles } = await supabase.from('profiles').select('id, name, role, company_id, username');
    console.log('\nProfiles:');
    profiles?.forEach(p => {
        console.log(` - ID: ${p.id}, name: ${p.name}, role: ${p.role}, username: ${p.username}`);
    });
}

main().then(() => process.exit(0));
