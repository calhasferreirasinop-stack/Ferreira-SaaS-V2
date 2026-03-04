import fetch from 'node-fetch';

async function run() {
    const loginRes = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData.role, loginData.name);
    const cookies = loginRes.headers.raw()['set-cookie'].map(c => c.split(';')[0]).join('; ');

    // Try the migration endpoint
    const migRes = await fetch('http://localhost:3000/api/migrate/type-product', {
        method: 'POST',
        headers: { 'Cookie': cookies, 'Content-Type': 'application/json' },
        body: '{}'
    });
    console.log('Migration status:', migRes.status);
    const migData = await migRes.text();
    console.log('Migration result:', migData.substring(0, 200));

    // Check products - should have type_product now
    const prodRes = await fetch('http://localhost:3000/api/products', {
        headers: { 'Cookie': cookies }
    });
    const products = await prodRes.json();
    console.log('\nProducts with type_product field:');
    products.slice(0, 3).forEach(p => console.log(`  ${p.name}: type_product=${p.type_product}`));
}

run().catch(console.error);
