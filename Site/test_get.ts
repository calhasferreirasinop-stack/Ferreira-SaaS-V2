import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: ests } = await supabase.from('estimates').select('id, company_id, estimate_items(*)').eq('id', '3e27e350-3952-472f-874f-6ee88b8cd663');
  console.log(JSON.stringify(ests, null, 2));
}
test();
