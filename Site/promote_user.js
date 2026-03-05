
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
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

    // Assume the first one is the one we want if it's not already MASTER
    const user = users[0];
    if (user) {
        console.log(`Promoting ${user.email} from ${user.role} to MASTER...`);
        const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'MASTER' })
            .eq('id', user.id);

        if (updateError) {
            console.error("Error updating user:", updateError);
        } else {
            console.log("Success! User promoted.");
        }
    } else {
        console.log("No users found.");
    }
}

promoteLatestUser();
