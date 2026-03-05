import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
    const email = 'admin@ferreiracalhas.com';
    const password = 'admin123';

    console.log('Attempting login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
        console.log('Login failed:', authError.message);
        return;
    }

    const userId = authData.user.id;
    console.log('Login success! User ID:', userId);

    console.log('Querying profile with ID:', userId);
    const { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (profError) {
        console.log('Profile query error:', profError.message);
    } else {
        console.log('Profile found:', profile);
    }
}

main();
