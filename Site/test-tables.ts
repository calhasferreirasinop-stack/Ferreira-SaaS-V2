import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    // Test pix_keys
    const { data: pix, error: pixErr } = await supabase.from('pix_keys').select('id').limit(1);
    console.log(pixErr ? `pix_keys ERROR: ${pixErr.message}` : `pix_keys OK`);

    // Test settings
    const { data: sett, error: settErr } = await supabase.from('settings').select('key').limit(1);
    console.log(settErr ? `settings ERROR: ${settErr.message}` : `settings OK`);

    // Test services
    const { data: svc, error: svcErr } = await supabase.from('services').select('id').limit(1);
    console.log(svcErr ? `services ERROR: ${svcErr.message}` : `services OK`);

    // Test posts
    const { data: posts, error: postsErr } = await supabase.from('posts').select('id').limit(1);
    console.log(postsErr ? `posts ERROR: ${postsErr.message}` : `posts OK`);

    // Test gallery
    const { data: gallery, error: galleryErr } = await supabase.from('gallery').select('id').limit(1);
    console.log(galleryErr ? `gallery ERROR: ${galleryErr.message}` : `gallery OK`);

    // Test testimonials
    const { data: test, error: testErr } = await supabase.from('testimonials').select('id').limit(1);
    console.log(testErr ? `testimonials ERROR: ${testErr.message}` : `testimonials OK`);

    // Test user_logs
    const { data: logs, error: logsErr } = await supabase.from('user_logs').select('id').limit(1);
    console.log(logsErr ? `user_logs ERROR: ${logsErr.message}` : `user_logs OK`);

    // Test payments
    const { data: pay, error: payErr } = await supabase.from('payments').select('id').limit(1);
    console.log(payErr ? `payments ERROR: ${payErr.message}` : `payments OK`);

    // Test activity_logs metadata column
    const { error: acErr } = await supabase.from('activity_logs').select('metadata').limit(1);
    console.log(acErr ? `activity_logs.metadata ERROR: ${acErr.message}` : `activity_logs.metadata OK`);
}

test();
