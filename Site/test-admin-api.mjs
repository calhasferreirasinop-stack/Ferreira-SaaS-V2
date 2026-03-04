import fetch from 'node-fetch';

async function test() {
    const loginRes = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' })
    });

    if (!loginRes.ok) {
        console.error('Login failed', await loginRes.text());
        return;
    }

    const cookies = loginRes.headers.raw()['set-cookie'];

    const dataRes = await fetch('http://localhost:3000/api/admin/data', {
        headers: {
            'Cookie': cookies.map(c => c.split(';')[0]).join('; ')
        }
    });

    const data = await dataRes.json();
    console.log("Quotes:", data.quotes?.length);

    console.log("--- FINANCIAL ---");
    const finSumRes = await fetch('http://localhost:3000/api/financial/summary', {
        headers: { 'Cookie': cookies.map(c => c.split(';')[0]).join('; ') }
    });
    console.log("Summary HTTP:", finSumRes.status);
    console.log("Summary:", await finSumRes.json());

    const finRes = await fetch('http://localhost:3000/api/financial', {
        headers: { 'Cookie': cookies.map(c => c.split(';')[0]).join('; ') }
    });
    console.log("List HTTP:", finRes.status);
    console.log("List:", await finRes.text());
}
test().catch(console.log);
