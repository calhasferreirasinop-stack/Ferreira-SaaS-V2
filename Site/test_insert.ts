import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: ests } = await supabase.from('estimates').select('id, company_id').limit(1);
  if (!ests || !ests.length) { console.log('No ests'); return; }
  const est = ests[0];
  
  const { data: po } = await supabase.from('production_orders').select('id').eq('estimate_id', est.id).limit(1);
  const poid = po && po.length ? po[0].id : null;
  
  if(!poid) {
     const {data: newpo} = await supabase.from('production_orders').insert({
       company_origin_id: est.company_id,
       company_target_id: est.company_id,
       estimate_id: est.id,
       client_name: 'test',
       status: 'in_production'
     }).select().single();
     poid = newpo.id;
  }
  
  const newItem = {
    production_order_id: poid,
    estimate_id: est.id,
    description: 'Teste',
    comodo: 'Sem Grupo',
    metragem: 10,
    concluido: false,
    company_id: est.company_id
  };
  
  console.log('Inserting:', newItem);
  const { data, error } = await supabase.from('production_items').insert([newItem]).select();
  console.log('Data:', data, 'Error:', error);
}
test();
