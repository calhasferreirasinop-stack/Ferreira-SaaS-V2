import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import busboy from 'busboy';
import path from 'path';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

const BUCKET = 'uploads';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseCookies(req: express.Request): Record<string, string> {
    const header = req.headers.cookie || '';
    return Object.fromEntries(
        header.split(';').map(c => {
            const [k, ...v] = c.trim().split('=');
            return [k.trim(), decodeURIComponent(v.join('='))];
        })
    );
}

function getClientIP(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0];
    return req.socket?.remoteAddress || 'unknown';
}

let logTableReady = false;
async function ensureLogTable() {
    if (logTableReady) return;
    try {
        await supabase.rpc('exec_sql', {
            sql: `CREATE TABLE IF NOT EXISTS user_logs (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER,
            username TEXT,
            action TEXT NOT NULL,
            details TEXT,
            menu TEXT,
            "ipAddress" TEXT,
            "errorMessage" TEXT,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )` });
    } catch { /* table might already exist */ }
    logTableReady = true;
}

async function logUserAction(opts: {
    userId?: number | null; username?: string; action: string;
    details?: string; menu?: string; ipAddress?: string; errorMessage?: string;
}) {
    try {
        await ensureLogTable();
        await supabase.from('user_logs').insert({
            userId: opts.userId || null,
            username: opts.username || 'system',
            action: opts.action,
            details: opts.details || null,
            menu: opts.menu || null,
            ipAddress: opts.ipAddress || null,
            errorMessage: opts.errorMessage || null,
            createdAt: new Date().toISOString(),
        });
    } catch (e: any) { console.error('[LOG] Failed to write log:', e.message); }
}

async function parseSession(req: express.Request): Promise<any | null> {
    const cookies = parseCookies(req);
    const session = cookies['session'];
    if (!session) return null;
    try {
        const decoded = JSON.parse(Buffer.from(session, 'base64').toString('utf8'));
        const { data: user } = await supabase
            .from('profiles')
            .select('id,username,name,email,role,active,company_id')
            .eq('id', decoded.userId)
            .eq('active', true)
            .single();
        if (user) {
            return {
                ...user,
                companyId: user.company_id
            };
        }
        return null;
    } catch { return null; }
}

function setSessionCookie(res: express.Response, userId: number) {
    const data = Buffer.from(JSON.stringify({ userId })).toString('base64');
    res.setHeader('Set-Cookie',
        `session=${data}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}; Path=/`
    );
}

async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = await parseSession(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).user = user;
    next();
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = await parseSession(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'admin' && user.role !== 'master') return res.status(403).json({ error: 'Forbidden' });
    (req as any).user = user;
    next();
}

async function requireMaster(req: express.Request, res: express.Response, next: express.NextFunction) {
    const user = await parseSession(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'master') return res.status(403).json({ error: 'Forbidden - Master only' });
    (req as any).user = user;
    next();
}

async function uploadToStorage(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
    const ext = path.extname(originalName) || '.bin';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return supabase.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
}

function parseMultipart(req: express.Request): Promise<{
    fields: Record<string, string>;
    files: Array<{ buffer: Buffer; originalname: string; mimetype: string; fieldname: string }>;
}> {
    return new Promise((resolve, reject) => {
        const bb = busboy({ headers: req.headers as Record<string, string> });
        const fields: Record<string, string> = {};
        const files: Array<{ buffer: Buffer; originalname: string; mimetype: string; fieldname: string }> = [];
        bb.on('field', (name, value) => { fields[name] = value; });
        bb.on('file', (fieldname, stream, info) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => files.push({ buffer: Buffer.concat(chunks), originalname: info.filename, mimetype: info.mimeType, fieldname }));
        });
        bb.on('finish', () => resolve({ fields, files }));
        bb.on('error', reject);
        req.pipe(bb);
    });
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body || {};
    const ip = getClientIP(req);
    const { data: users } = await supabase.from('profiles')
        .select('*').eq('username', username).eq('active', true).limit(1);
    const user = users?.[0];
    if (user && bcrypt.compareSync(password, user.password)) {
        setSessionCookie(res, user.id);
        res.setHeader('Set-Cookie', [
            `session=${Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}; Path=/`,
            'admin_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
        ]);
        logUserAction({ userId: user.id, username: user.username, action: 'LOGIN_SUCCESS', details: `Login bem-sucedido`, menu: 'Auth', ipAddress: ip });
        return res.json({ success: true, role: user.role, name: user.name || user.username });
    }
    logUserAction({ username: username || 'unknown', action: 'LOGIN_FAILED', details: `Tentativa de login falhou para: ${username || '(vazio)'}`, menu: 'Auth', ipAddress: ip, errorMessage: !user ? 'Usuário não encontrado' : 'Senha incorreta' });
    return res.status(401).json({ error: 'Credenciais inválidas' });
});

app.post('/api/logout', async (req, res) => {
    const user = await parseSession(req);
    if (user) logUserAction({ userId: user.id, username: user.username, action: 'LOGOUT', details: 'Usuário fez logout', menu: 'Auth', ipAddress: getClientIP(req) });
    res.setHeader('Set-Cookie', [
        'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
        'admin_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
    ]);
    res.json({ success: true });
});

app.get('/api/auth/check', async (req, res) => {
    const user = await parseSession(req);
    if (user) return res.json({ authenticated: true, role: user.role, name: user.name || user.username, id: user.id });
    const cookies = parseCookies(req as any);
    if (cookies['admin_session'] === 'authenticated') {
        const { data: adminUser } = await supabase.from('profiles').select('id,username,role,name,company_id').eq('username', 'admin').single();
        if (adminUser) return res.json({ authenticated: true, role: adminUser.role, name: adminUser.name || adminUser.username, id: adminUser.id, companyId: adminUser.company_id });
    }
    return res.json({ authenticated: false });
});

app.get('/api/auth/me', authenticate as any, (req: any, res) => res.json(req.user));

// ── USERS ───────────────────────────────────────────────────────────────────
app.get('/api/users', requireAdmin as any, async (req: any, res) => {
    const { data } = await supabase.from('profiles').select('id,username,name,email,phone,role,active,created_at')
        .eq('company_id', req.user.companyId)
        .order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/users', requireAdmin as any, async (req: any, res) => {
    const { username, password, name, email, phone, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username e senha obrigatórios' });
    if ((role === 'admin' || role === 'master') && req.user.role !== 'master')
        return res.status(403).json({ error: 'Apenas master pode criar admins' });
    const { data, error } = await supabase.from('profiles').insert({
        username,
        password: bcrypt.hashSync(password, 10),
        name, email, phone, role: role || 'user', active: true, company_id: req.user.companyId
    }).select('id,username,name,email,phone,role,active').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/users/:id', requireAdmin as any, async (req: any, res) => {
    const id = req.params.id;
    const { name, email, phone, active, role, password } = req.body || {};
    const updateData: any = { name, email, phone, active };
    if (role !== undefined && req.user.role === 'master') updateData.role = role;
    if (password) updateData.password = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase.from('profiles').update(updateData)
        .eq('id', id).eq('company_id', req.user.companyId).select('id,username,name,email,phone,role,active').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/users/:id', requireAdmin as any, async (req: any, res) => {
    const id = req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
    await supabase.from('profiles').delete().eq('id', id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
app.get('/api/settings', async (_req, res) => {
    const { data } = await supabase.from('settings').select('*');
    res.json((data || []).reduce((acc: any, c: any) => ({ ...acc, [c.key]: c.value }), {}));
});

app.post('/api/settings', requireMaster as any, async (req, res) => {
    const ct = req.headers['content-type'] || '';
    let upserts: { key: string; value: string }[] = [];
    if (ct.includes('multipart/form-data')) {
        const { fields, files } = await parseMultipart(req);
        upserts = Object.entries(fields).map(([key, value]) => ({ key, value: String(value) }));
        for (const [field, settKey] of [['logo', 'logoUrl'], ['heroImage', 'heroImageUrl'], ['pixQrCode', 'pixQrCodeUrl']]) {
            const f = files.find(x => x.fieldname === field);
            if (f) upserts.push({ key: settKey, value: await uploadToStorage(f.buffer, f.originalname, f.mimetype) });
        }
    } else {
        upserts = Object.entries(req.body || {}).map(([key, value]) => ({ key, value: String(value) }));
    }
    await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
    res.json({ success: true });
});

// ── ADMIN DATA ───────────────────────────────────────────────────────────────
app.get('/api/admin/data', authenticate as any, async (req: any, res) => {
    try {
        const isAdminOrMaster = req.user.role === 'admin' || req.user.role === 'master';
        const companyId = req.user.companyId;
        const [settingsRes, servicesRes, postsRes, galleryRes, testimonialsRes, productsRes] = await Promise.all([
            supabase.from('settings').select('*').eq('company_id', companyId),
            supabase.from('services').select('*').eq('company_id', companyId),
            supabase.from('posts').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
            supabase.from('gallery').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
            supabase.from('testimonials').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
            supabase.from('products').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        ]);
        let quotesQuery = supabase.from('estimates').select('*, profiles(name)').eq('company_id', companyId).order('created_at', { ascending: false });
        if (!isAdminOrMaster) quotesQuery = quotesQuery.eq('client_id', req.user.id);
        const quotesRes = await quotesQuery;
        const profilesRes = isAdminOrMaster
            ? await supabase.from('profiles').select('id,username,name,email,phone,role,active,created_at').eq('company_id', companyId).order('created_at', { ascending: false })
            : { data: [] };
        const settings = (settingsRes.data || []).reduce((acc: any, c: any) => ({ ...acc, [c.key]: c.value }), {});
        res.json({
            settings, services: servicesRes.data || [], posts: postsRes.data || [], gallery: galleryRes.data || [],
            testimonials: testimonialsRes.data || [],
            quotes: (quotesRes.data || []).map((q: any) => ({
                ...q, clientName: q.profiles?.name || 'Cliente', createdAt: q.created_at, totalValue: q.total_amount || 0, finalValue: q.final_amount || 0
            })),
            inventory: isAdminOrMaster ? (productsRes.data || []) : [],
            users: (profilesRes.data || []).map((u: any) => ({ ...u, createdAt: u.created_at })),
            currentUser: req.user,
        });
    } catch (e) {
        console.error('[ADMIN_DATA_ERROR]', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── SERVICES ─────────────────────────────────────────────────────────────────
app.get('/api/services', authenticate as any, async (req: any, res) => {
    const { data } = await supabase.from('services').select('*').eq('company_id', req.user.companyId);
    res.json(data || []);
});
app.post('/api/services', requireAdmin as any, async (req: any, res) => {
    const ct = req.headers['content-type'] || '';
    let title: string, description: string, imageUrl: string | null = null;
    if (ct.includes('multipart/form-data')) {
        const { fields, files } = await parseMultipart(req);
        title = fields.title; description = fields.description;
        const f = files.find(x => x.fieldname === 'image');
        if (f) imageUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype);
    } else ({ title, description, imageUrl } = req.body || {});
    const { data, error } = await supabase.from('services').insert({ title, description, imageUrl, company_id: req.user.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/services/delete/:id', requireAdmin as any, async (req: any, res) => {
    await supabase.from('services').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── POSTS ─────────────────────────────────────────────────────────────────────
app.get('/api/posts', authenticate as any, async (req: any, res) => {
    const { data } = await supabase.from('posts').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    res.json(data || []);
});
app.post('/api/posts', requireAdmin as any, async (req: any, res) => {
    const ct = req.headers['content-type'] || '';
    let title: string, content: string, imageUrl: string | null = null;
    if (ct.includes('multipart/form-data')) {
        const { fields, files } = await parseMultipart(req);
        title = fields.title; content = fields.content;
        const f = files.find(x => x.fieldname === 'image');
        if (f) imageUrl = await uploadToStorage(f.buffer, f.originalname, f.mimetype);
    } else ({ title, content, imageUrl } = req.body || {});
    const { data, error } = await supabase.from('posts').insert({ title, content, imageUrl, company_id: req.user.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/posts/delete/:id', requireAdmin as any, async (req: any, res) => {
    await supabase.from('posts').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── GALLERY ───────────────────────────────────────────────────────────────────
app.get('/api/gallery', authenticate as any, async (req: any, res) => {
    const { serviceId } = req.query;
    let q = supabase.from('gallery').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    if (serviceId) q = q.eq('service_id', serviceId);
    const { data } = await q;
    res.json((data || []).map(i => ({ ...i, createdAt: i.created_at, serviceId: i.service_id })));
});
app.post('/api/gallery', requireAdmin as any, async (req: any, res) => {
    const { fields, files } = await parseMultipart(req);
    if (!files.length) return res.status(400).json({ error: 'At least one image required' });
    const serviceId = fields.serviceId || null;
    const items = [];
    for (const f of files) {
        const url = await uploadToStorage(f.buffer, f.originalname, f.mimetype);
        items.push({ imageUrl: url, description: fields.description || '', service_id: serviceId, company_id: req.user.companyId });
    }
    const { data, error } = await supabase.from('gallery').insert(items).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/gallery/bulk-delete', requireAdmin as any, async (req: any, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
    await supabase.from('gallery').delete().in('id', ids).eq('company_id', req.user.companyId);
    res.json({ success: true });
});
app.post('/api/gallery/delete/:id', requireAdmin as any, async (req: any, res) => {
    await supabase.from('gallery').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── TESTIMONIALS ──────────────────────────────────────────────────────────────
app.get('/api/testimonials', authenticate as any, async (req: any, res) => {
    const { data } = await supabase.from('testimonials').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    res.json((data || []).map(i => ({ ...i, createdAt: i.created_at })));
});
app.post('/api/testimonials', requireAdmin as any, async (req: any, res) => {
    const { author, content, rating } = req.body || {};
    const { data, error } = await supabase.from('testimonials').insert({ author, content, rating: rating || 5, company_id: req.user.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/testimonials/delete/:id', requireAdmin as any, async (req: any, res) => {
    await supabase.from('testimonials').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── QUOTES ────────────────────────────────────────────────────────────────────
app.get('/api/quotes/pending-count', requireAdmin as any, async (req: any, res) => {
    const { count } = await supabase.from('estimates').select('id', { count: 'exact', head: true }).eq('company_id', req.user.companyId).eq('status', 'pending');
    res.json({ count: count || 0 });
});
app.get('/api/quotes', authenticate as any, async (req: any, res) => {
    let q = supabase.from('estimates').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    if (req.user.role === 'user') q = q.eq('client_id', req.user.id);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map((q: any) => ({ ...q, createdAt: q.created_at, totalValue: q.total_amount || 0, finalValue: q.final_amount || 0 })));
});
app.post('/api/quotes', authenticate as any, async (req: any, res) => {
    const { clientName, bends, notes, totalValue: passedTotal, adminCreated, status: requestedStatus } = req.body || {};
    let totalM2 = 0; if (Array.isArray(bends)) { for (const b of bends) totalM2 += parseFloat(b.m2 || 0); }
    const { data: settRows } = await supabase.from('settings').select('*').eq('company_id', req.user.companyId);
    const sett = (settRows || []).reduce((a: any, s: any) => ({ ...a, [s.key]: s.value }), {});
    const pricePerM2 = parseFloat(sett.pricePerM2 || '50');
    const totalValue = adminCreated && passedTotal ? parseFloat(passedTotal) : totalM2 * pricePerM2;
    const quoteStatus = requestedStatus === 'rascunho' ? 'draft' : 'pending';
    const quoteNotes = clientName ? `[CLIENT: ${clientName}] ${notes || ''}` : (notes || '');
    const { data: quote, error } = await supabase.from('estimates').insert({
        company_id: req.user.companyId, client_id: req.user.id, total_amount: totalValue, final_amount: totalValue, notes: quoteNotes, status: quoteStatus
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (Array.isArray(bends) && bends.length > 0) {
        await supabase.from('estimate_items').insert(bends.map((b: any) => ({
            estimate_id: quote.id, description: `[BEND] ${JSON.stringify(b)}`, quantity: 1, unit_price: pricePerM2, total_price: b.m2 * pricePerM2
        })));
    }
    res.json(quote);
});
app.put('/api/quotes/:id', authenticate as any, async (req: any, res) => {
    const id = req.params.id;
    const { clientName, bends, notes } = req.body || {};
    const { data: current } = await supabase.from('estimates').select('*').eq('id', id).eq('company_id', req.user.companyId).single();
    if (!current) return res.status(404).json({ error: 'Orçamento não encontrado' });
    if (req.user.role === 'user' && current.client_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    let totalM2 = 0; if (Array.isArray(bends)) { for (const b of bends) totalM2 += parseFloat(b.m2 || 0); }
    const { data: settRows } = await supabase.from('settings').select('*').eq('company_id', req.user.companyId);
    const sett = (settRows || []).reduce((a: any, s: any) => ({ ...a, [s.key]: s.value }), {});
    const pricePerM2 = parseFloat(sett.pricePerM2 || '50');
    const totalValue = totalM2 * pricePerM2;
    const quoteNotes = clientName ? `[CLIENT: ${clientName}] ${notes || ''}` : (notes || current.notes || '');
    const { data: quote, error } = await supabase.from('estimates').update({
        total_amount: totalValue, final_amount: totalValue, notes: quoteNotes, updated_at: new Date().toISOString()
    }).eq('id', id).eq('company_id', req.user.companyId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('estimate_items').delete().eq('estimate_id', id);
    if (Array.isArray(bends) && bends.length > 0) {
        await supabase.from('estimate_items').insert(bends.map((b: any) => ({
            estimate_id: id, description: `[BEND] ${JSON.stringify(b)}`, quantity: 1, unit_price: pricePerM2, total_price: b.m2 * pricePerM2
        })));
    }
    res.json(quote);
});
app.get('/api/quotes/:id/bends', authenticate as any, async (req: any, res) => {
    const id = req.params.id;
    console.log(`[TRACE_SLUG_BENDS_1234] ID: ${id}`);
    const { data: quote } = await supabase.from('estimates').select('client_id').eq('id', id).eq('company_id', req.user.companyId).single();
    if (!quote) return res.status(404).json({ error: 'Orçamento não encontrado' });
    if (req.user.role === 'user' && quote.client_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    const { data, error } = await supabase.from('estimate_items').select('description').eq('estimate_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map((i: any) => {
        if (i.description && i.description.startsWith('[BEND] ')) { try { return JSON.parse(i.description.substring(7)); } catch { return {}; } }
        return {};
    }));
});
app.put('/api/quotes/:id/status', authenticate as any, async (req: any, res) => {
    const id = req.params.id; const { status, finalValue, notes } = req.body || {};
    const { data: current } = await supabase.from('estimates').select('*').eq('id', id).eq('company_id', req.user.companyId).single();
    if (!current) return res.status(404).json({ error: 'Orçamento não encontrado' });
    if (req.user.role === 'user' && current.client_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (finalValue !== undefined && (req.user.role === 'admin' || req.user.role === 'master')) updateData.final_amount = parseFloat(finalValue);
    if (notes !== undefined) updateData.notes = notes;
    const { data: quote, error } = await supabase.from('estimates').update(updateData).eq('id', id).eq('company_id', req.user.companyId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (status === 'paid' && quote) {
        await supabase.from('payments').insert({ company_id: req.user.companyId, estimate_id: id, amount: quote.final_amount || quote.total_amount, payment_method: 'pix', status: 'completed', paid_at: new Date().toISOString() });
    }
    res.json(quote);
});

// ── DISCOUNTS & PROOF ─────────────────────────────────────────────────────────
app.post('/api/quotes/:id/discount', requireMaster as any, async (req: any, res) => {
    const id = req.params.id; const { discountValue } = req.body || {};
    const { data: quote } = await supabase.from('estimates').select('*').eq('id', id).eq('company_id', req.user.companyId).single();
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const finalAmount = Math.max(0, (quote.total_amount || 0) - (discountValue || 0));
    await supabase.from('estimates').update({ discount_amount: discountValue, final_amount: finalAmount, updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', req.user.companyId);
    res.json({ success: true, finalValue: finalAmount });
});
app.post('/api/quotes/:id/proof', authenticate as any, async (req: any, res) => {
    const id = req.params.id; const { data: quote } = await supabase.from('estimates').select('client_id, notes').eq('id', id).eq('company_id', req.user.companyId).single();
    if (!quote) return res.status(404).json({ error: 'Not found' });
    const { files } = await parseMultipart(req); const f = files[0]; if (!f) return res.status(400).json({ error: 'File required' });
    const url = await uploadToStorage(f.buffer, f.originalname, f.mimetype);
    await supabase.from('estimates').update({ notes: (quote.notes || '') + `\n[COMPROVANTE: ${url}]`, updated_at: new Date().toISOString() }).eq('id', id).eq('company_id', req.user.companyId);
    res.json({ success: true, pixProofUrl: url });
});

// ── INVENTORY ────────────────────────────────────────────────────────────────
app.get('/api/inventory', requireAdmin as any, async (req: any, res) => {
    const { data } = await supabase.from('products').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    res.json(data || []);
});
app.post('/api/inventory', requireAdmin as any, async (req: any, res) => {
    const { description, widthM, lengthM, costPerUnit, notes, lowStockThresholdM2 } = req.body || {};
    const wM = parseFloat(widthM) || 1.2; const lM = parseFloat(lengthM) || 33;
    const { data, error } = await supabase.from('products').insert({ description, widthM: wM, lengthM: lM, availableM2: wM * lM, costPerUnit, notes, lowStockThresholdM2: parseFloat(lowStockThresholdM2) || 5, company_id: req.user.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/inventory/batch', requireAdmin as any, async (req: any, res) => {
    const { entries } = req.body || {}; if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries required' });
    const inserts = entries.map((e: any) => ({ description: e.description, widthM: parseFloat(e.widthM) || 1.2, lengthM: parseFloat(e.lengthM) || 33, availableM2: (parseFloat(e.widthM) || 1.2) * (parseFloat(e.lengthM) || 33), costPerUnit: parseFloat(e.costPerUnit) || 0, notes: e.notes, lowStockThresholdM2: parseFloat(e.lowStockThresholdM2) || 5, company_id: req.user.companyId }));
    const { data, error } = await supabase.from('products').insert(inserts).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.put('/api/inventory/:id', requireAdmin as any, async (req: any, res) => {
    const { data, error } = await supabase.from('products').update(req.body).eq('id', req.params.id).eq('company_id', req.user.companyId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.delete('/api/inventory/:id', requireAdmin as any, async (req: any, res) => {
    await supabase.from('products').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
    res.json({ success: true });
});

// ── FINANCIAL ───────────────────────────────────────────────────────────────
app.get('/api/financial', authenticate as any, async (req: any, res) => {
    const { from, to, method } = req.query;
    let q = supabase.from('payments').select('*, estimates(*)').eq('company_id', req.user.companyId).order('paid_at', { ascending: false });
    if (from) q = q.gte('paid_at', from as string); if (to) q = q.lte('paid_at', to as string); if (method) q = q.eq('payment_method', method as string);
    const { data, error } = await q; if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map((p: any) => ({ ...p, paidAt: p.paid_at, paymentMethod: p.payment_method, netValue: p.amount, clientName: p.estimates?.clientName || 'Cliente' })));
});
app.get('/api/financial/summary', authenticate as any, async (req: any, res) => {
    const now = new Date(); const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: all } = await supabase.from('payments').select('amount, paid_at').eq('company_id', req.user.companyId);
    if (!all) return res.json({ totalAll: 0, totalToday: 0, totalMonth: 0, countAll: 0, countToday: 0, countMonth: 0, ticketAverage: 0 });
    const sum = (rows: any[]) => rows.reduce((a, r) => a + parseFloat(r.amount || 0), 0);
    const today = all.filter(r => r.paid_at >= todayStart); const month = all.filter(r => r.paid_at >= monthStart);
    res.json({ totalAll: sum(all), totalToday: sum(today), totalMonth: sum(month), countAll: all.length, countToday: today.length, countMonth: month.length, ticketAverage: all.length > 0 ? sum(all) / all.length : 0 });
});

// ── REPORT SETTINGS ─────────────────────────────────────────────────────────────
app.post('/api/report-settings', requireAdmin as any, async (req: any, res) => {
    const parsed = req.headers['content-type']?.includes('multipart/form-data') ? await parseMultipart(req) : { fields: req.body, files: [] };
    const { fields, files } = parsed;
    for (const key of ['reportCompanyName', 'reportHeaderText', 'reportFooterText', 'reportPhone', 'reportEmail', 'reportAddress']) {
        if (fields[key] !== undefined) await supabase.from('settings').upsert({ key, value: fields[key], company_id: req.user.companyId }, { onConflict: 'key, company_id' });
    }
    const f = files.find(x => x.fieldname === 'reportLogoFile');
    if (f) { const url = await uploadToStorage(f.buffer, f.originalname, f.mimetype); await supabase.from('settings').upsert({ key: 'reportLogo', value: url, company_id: req.user.companyId }, { onConflict: 'key, company_id' }); }
    res.json({ success: true });
});

// ── PIX KEYS ─────────────────────────────────────────────────────────────────
app.get('/api/pix-keys', async (_req, res) => {
    const { data } = await supabase.from('pix_keys').select('*').order('sort_order', { ascending: true });
    res.json((data || []).map(k => ({ ...k, pixKey: k.pix_key, pixCode: k.pix_code, qrCodeUrl: k.qr_code_url, sortOrder: k.sort_order })));
});
app.post('/api/pix-keys', requireMaster as any, async (req, res) => {
    const { pixKey, pixCode, qrCodeUrl, sortOrder } = req.body || {};
    const { data, error } = await supabase.from('pix_keys').insert({ pix_key: pixKey, pix_code: pixCode, qr_code_url: qrCodeUrl, sort_order: sortOrder || 0, company_id: (req as any).user.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});
app.delete('/api/pix-keys/:id', requireMaster as any, async (req, res) => {
    await supabase.from('pix_keys').delete().eq('id', req.params.id).eq('company_id', (req as any).user.companyId);
    res.json({ success: true });
});

export default (req: VercelRequest, res: VercelResponse) => app(req as any, res as any);
