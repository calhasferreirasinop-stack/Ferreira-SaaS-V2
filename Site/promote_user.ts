
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function promoteLatestUser() {
    const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('id, email, username, role')
        .order('created_at', { ascending: false })
        .limit(5);

    if (fetchError) {
        console.error("Error fetching users:", fetchError);
        return;
    }

    console.log("Recent users:");
    users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));

    // Identify the latest user that is NOT MASTER
    const userToPromote = users.find(u => u.role !== 'MASTER');

    if (userToPromote) {
        console.log(`Promoting ${userToPromote.email} from ${userToPromote.role} to MASTER...`);
        const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'MASTER' })
            .eq('id', userToPromote.id);

        if (updateError) {
            console.error("Error updating user:", updateError);
        } else {
            console.log("Success! User promoted.");
        }
    } else {
        console.log("No users found that need promotion (all are MASTER).");
    }
}

promoteLatestUser();
