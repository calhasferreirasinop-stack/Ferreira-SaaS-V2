const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const PROJECT_REF = 'dembegkbdvlwkyhftwii';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type_product TEXT NOT NULL DEFAULT 'product'; UPDATE public.products SET type_product = 'product' WHERE type_product IS NULL; ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_type_product_check; ALTER TABLE public.products ADD CONSTRAINT products_type_product_check CHECK (type_product IN ('product', 'service'));`;

function request(options, bodyObj) {
    return new Promise((resolve, reject) => {
        const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
        const req = https.request({
            ...options,
            headers: {
                ...options.headers,
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function tryVariousPaths() {
    // Try direct pg execution via the Supabase DB URL
    // The connection string format for Supabase is:
    // postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

    const paths = [
        `/v1/projects/${PROJECT_REF}/database/query`,
        `/v1/projects/${PROJECT_REF}/db/query`,
    ];

    for (const p of paths) {
        const result = await request({
            hostname: 'api.supabase.com',
            port: 443,
            path: p,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'x-supabase-role': 'service_role'
            }
        }, { query: sql });
        console.log(`${p}: ${result.status} - ${result.body.substring(0, 100)}`);
    }

    // Also try the pg-meta endpoint
    const pgMeta = await request({
        hostname: `${PROJECT_REF}.supabase.co`,
        port: 443,
        path: `/pg-meta/v1/query`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
        }
    }, { query: sql });
    console.log(`pg-meta: ${pgMeta.status} - ${pgMeta.body.substring(0, 100)}`);
}

tryVariousPaths().catch(console.error);
