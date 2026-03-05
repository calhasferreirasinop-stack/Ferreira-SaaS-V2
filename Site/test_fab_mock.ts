import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const estimateId = '4dd0a718-257a-47d9-9bbe-329046067e5b'; // Most recent
  const companyId = 'd9604efa-eecb-4e93-a118-d1d2715bc8ba';
  
  const { data: est, error: estErr } = await supabase
      .from('estimates')
      .select('*, estimate_items(*)')
      .eq('id', estimateId)
      .single();
      
  console.log('ESTIMATE ERROR:', estErr);
  
  let clientDispName = 'Cliente';
  
  const { data: newPo, error: newPoErr } = await supabase
        .from('production_orders')
        .insert({
          company_origin_id: companyId,
          company_target_id: companyId,
          estimate_id: estimateId,
          client_name: clientDispName,
          status: 'in_production'
        })
        .select()
        .single();
        
   console.log('NEW PO ERROR:', newPoErr);
   
   if (newPo) {
     const currentPo = newPo;
     const itemsList = est.estimate_items || [];
     const newItems = [];
     
     for (const item of itemsList) {
        if ((item.description || '').startsWith('[BEND]')) {
          try {
            const bendStr = item.description.replace('[BEND]', '').trim();
            const bendData = JSON.parse(bendStr);
            const lengths = Array.isArray(bendData.lengths) ? bendData.lengths.filter((l) => parseFloat(l) > 0) : [];

            let desc = 'Dobra Customizada';
            let comodo = 'Sem Grupo';
            if (bendData.productName) desc = bendData.productName;
            if (bendData.group_name) comodo = bendData.group_name;

            if (lengths.length > 0) {
              for (const len of lengths) {
                newItems.push({
                  production_order_id: currentPo.id,
                  estimate_id: estimateId,
                  description: desc,
                  comodo: comodo,
                  metragem: Math.abs(parseFloat(len)),
                  concluido: false,
                  company_id: companyId
                });
              }
            } else {
              newItems.push({
                production_order_id: currentPo.id,
                estimate_id: estimateId,
                description: desc,
                comodo: comodo,
                metragem: Math.abs(parseFloat(bendData.totalLengthM)) || 1, // Se não tiver metragem definida, considera 1 ou totalLengthM
                concluido: false,
                company_id: companyId
              });
            }
          } catch (e) {
            console.error('Falha ao processar BEND string', e);
          }
        }
      }
      
      console.log('NEW ITEMS:', newItems);
      
      if (newItems.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('production_items')
          .insert(newItems)
          .select();
          
        console.log('INSERT ITEMS ERROR:', insErr);
      }
   }
}

test();
