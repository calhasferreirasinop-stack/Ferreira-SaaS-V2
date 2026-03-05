const fetch = require('node-fetch');
async function test() {
  const cookie = 'sb-dembegkbdvlwkyhftwii-auth-token=' + encodeURIComponent(JSON.stringify([{
    access_token: 'fake', 
    user: { id: 'test' }
  }])); 
  // actually, we can't test standard auth easily without an active session. Let's just create a script that calls the Supabase API to fetch a real estimate and what happens when we try to create an order.
}
