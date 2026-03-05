
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://dembegkbdvlwkyhftwii.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function promoteLatest() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("ERROR FETCHING PROFILES:", error);
        return;
    }

    console.log("RECENT PROFILES:", profiles);

    const target = profiles.find(p => p.role !== 'master');
    if (target) {
        console.log(`Promoting profile ${target.id} (${target.name}) to master...`);
        const { error: upError } = await supabase
            .from('profiles')
            .update({ role: 'master' })
            .eq('id', target.id);

        if (upError) console.error("UPDATE ERROR:", upError);
        else console.log("SUCCESS: User promoted to master.");
    } else {
        console.log("No profiles found that need promotion.");
    }
}
promoteLatest();
