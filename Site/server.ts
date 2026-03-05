import express from 'express';
// O Vite agora será carregado apenas quando necessário (Modo Dev)
// import { createServer as createViteServer } from 'vite'; 
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();


const app = express();
const PORT = 3000;



app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});


const sanitizeEnv = (val: string | undefined) => val ? val.replace(/['"]+/g, '').trim() : '';
const supabaseUrl = sanitizeEnv(process.env.SUPABASE_URL);
const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnonKey = sanitizeEnv(process.env.SUPABASE_ANON_KEY);

// Inicialização segura do Supabase (Evita crash no Vercel)
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  { auth: { persistSession: false } }
);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️ ATENÇÃO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados corretamente no Vercel.');
}

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!process.env.VERCEL) {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));
}

// --- Seed (Disabled in V2 - Handled by Migration 005) ---
async function seedDatabase() {
  console.log('ℹ️ Seed skip (Handled by Migration 005 and Auth Triggers)');
}

/**
 * Popula automaticamente uma nova company com produtos e serviços padrão (Item 3)
 */
async function seedDefaultProducts(companyId: string) {
  if (!companyId) {
    console.error('[SEED_ERROR] Nenhuma company_id fornecida.');
    return;
  }

  console.log(`[SEED] Verificando produtos para a empresa: ${companyId}`);

  try {
    // 1. Verificar se existem produtos usando consulta de dados em vez de cabeçalho
    const { data: existing, error: checkErr } = await supabase
      .from('products')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (checkErr) throw checkErr;

    if (existing && existing.length > 0) {
      console.log(`[SEED] Empresa ${companyId} já possui produtos. Pulando...`);
      return;
    }

    console.log(`[SEED] Populando produtos padrão para a nova company: ${companyId}`);

    const defaultItems = [
      { company_id: companyId, name: 'Calha Moldura', type_product: 'product' },
      { company_id: companyId, name: 'Condutor', type_product: 'product' },
      { company_id: companyId, name: 'Calha Agua Furtada', type_product: 'product' },
      { company_id: companyId, name: 'Calha Chalé', type_product: 'product' },
      { company_id: companyId, name: 'Calha Cocho', type_product: 'product' },
      { company_id: companyId, name: 'Rufos', type_product: 'product' },
      { company_id: companyId, name: 'Reparo', type_product: 'service' },
      { company_id: companyId, name: 'Servico', type_product: 'service' },
      { company_id: companyId, name: 'Pintura', type_product: 'service' },
      { company_id: companyId, name: 'Troca de Telhado', type_product: 'service' }
    ];

    const { error: insertErr } = await supabase.from('products').insert(defaultItems);
    if (insertErr) throw insertErr;

    console.log(`[SEED_SUCCESS] ${defaultItems.length} itens criados para ${companyId}`);
  } catch (err: any) {
    console.error(`[SEED_CRITICAL_ERROR] Falha total no seed: ${err.message}`);
  }
}


// Multer - Em produção (ou Vercel), usamos MemoryStorage para enviar ao Supabase Storage.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Helper para upload no Supabase Storage (Substitui o disco local no Vercel/Prod)
 */
async function uploadToSupabase(file: Express.Multer.File, bucket = 'uploads'): Promise<string> {
  const ext = path.extname(file.originalname);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('[STORAGE_ERROR]', error);
    throw new Error('Falha ao subir arquivo para o storage: ' + error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}
// --- Security Helpers ---
const rateLimitMap = new Map<string, { count: number, reset: number }>();
const checkRateLimit = (ip: string, limit = 50, windowMs = 60000) => {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 1;
    entry.reset = now + windowMs;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);
  return entry.count <= limit;
};

const sanitize = (data: any) => {
  if (!data) return data;
  const sensitiveKeys = ['password', 'token', 'session', 'cookie', 'secret', 'key'];
  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
};

// --- Auth Middleware (SaaS V2) ---
interface AuthUser {
  id: string;      // supabase auth.uid()
  companyId: string;
  role: string;
  name?: string;
  username?: string;
}


const validTypes = ['product', 'service'];

const parseSession = async (req: any): Promise<AuthUser | null> => {
  const session = req.cookies.session;
  const legacyAdminSession = req.cookies.admin_session;

  console.log(`[AUTH_DEBUG] Cookies: session=${!!session}, legacy=${legacyAdminSession}`);

  if (!session && legacyAdminSession !== 'authenticated') {
    console.log(`[AUTH_DEBUG] No session and legacy is not 'authenticated'`);
    return null;
  }

  try {
    let userId: string | null = null;

    if (session) {
      const decoded = Buffer.from(session, 'base64').toString('utf8');
      try {
        const parsed = JSON.parse(decoded);
        userId = parsed.userId;
        console.log(`[AUTH_DEBUG] Derived userId from session: ${userId}`);
      } catch (e) {
        console.warn(`[AUTH_DEBUG] Malformed session cookie`);
      }
    }

    // Fallback for legacy admin session
    if (!userId && legacyAdminSession === 'authenticated') {
      console.log(`[AUTH_DEBUG] Using legacy fallback`);
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'master')
        .limit(1)
        .single();
      if (adminProfile) {
        userId = adminProfile.id;
        console.log(`[AUTH_DEBUG] Derived userId from legacy fallback: ${userId}`);
      } else {
        console.log(`[AUTH_DEBUG] Legacy fallback failed: No master profile found`);
      }
    }

    if (!userId) {
      console.log(`[AUTH_DEBUG] No userId found after session and legacy checks`);
      return null;
    }

    // SaaS V2: Fetch profile and company association
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, company_id, role, name')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error(`[AUTH_ERROR] User: ${userId} | Reason: Profile missing in database`);
      } else {
        console.error(`[AUTH_ERROR] User: ${userId} | Reason: Database error | Details: ${error.message}`);
      }
      return null;
    }

    if (!profile || !profile.company_id) {
      console.error(`[AUTH_ERROR] User: ${userId} | Reason: Company association missing`);
      return null;
    }

    // Success log (sanitized implicitly by not logging req.headers/cookies)
    console.log(`[AUTH_SUCCESS] User: ${userId} | Company: ${profile.company_id} | Role: ${profile.role}`);

    return {
      id: profile.id,
      companyId: profile.company_id,
      role: profile.role,
      name: profile.name,
      username: profile.name
    } as AuthUser;

  } catch (err) {
    console.error('[AUTH_EXCEPTION] Unexpected failure in parseSession:', err);
    return null;
  }
};

const authenticate = async (req: any, res: any, next: any) => {
  const user = await parseSession(req);
  if (!user) return res.status(401).json({ error: 'Sessão inválida ou perfil não encontrado' });
  req.user = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  const user = await parseSession(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });
  if (user.role !== 'admin' && user.role !== 'master') return res.status(403).json({ error: 'Acesso negado' });
  req.user = user;
  next();
};

const requireMaster = async (req: any, res: any, next: any) => {
  const user = await parseSession(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });
  if (user.role !== 'master') return res.status(403).json({ error: 'Acesso Master necessário' });
  req.user = user;
  next();
};

// =====================
// EMERGENCY SETUP Route (fixes missing schema columns + creates admin)
// =====================
app.post('/api/setup', async (req: any, res) => {
  const { secret } = req.body || {};
  if (secret !== 'ferreira-setup-2024') return res.status(403).json({ error: 'Forbidden' });

  const results: string[] = [];

  // 1. Get first company
  const { data: company } = await supabase.from('companies').select('id, name').limit(1).single();
  if (!company) return res.status(500).json({ error: 'No company found.' });
  const companyId = company.id;
  results.push(`Company: ${companyId} (${company.name})`);

  // 2. Get existing profiles
  const { data: profiles } = await supabase.from('profiles').select('*');
  results.push(`Profiles in DB: ${profiles?.length || 0}`);

  // 3. List Supabase Auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUserList = (authData?.users || []) as Array<{ id: string; email?: string }>;
  results.push(`Auth users: ${authUserList.length}`);
  authUserList.forEach((u: any) => results.push(`  Auth user: ${u.id} | ${u.email}`));
  profiles?.forEach((p: any) => results.push(`  Profile: ${p.id} | username: ${p.username} | role: ${p.role}`));

  // 4. Check if admin profile already has the correct auth user linked
  const adminEmail = 'admin@ferreiracalhas.com';
  const existingAuthAdmin = authUserList.find((u: any) => u.email === adminEmail);

  let adminProfileId: string | null = null;

  if (existingAuthAdmin) {
    results.push(`Auth admin already exists: ${existingAuthAdmin.id}`);

    // Update password in auth
    await supabase.auth.admin.updateUserById(existingAuthAdmin.id, { password: 'admin123' });
    results.push(`Auth password reset to admin123`);

    adminProfileId = existingAuthAdmin.id;

    // Check if profile with this ID exists
    const existingProfile = profiles?.find(p => p.id === existingAuthAdmin.id);
    if (!existingProfile) {
      // Create profile for this auth user
      const { error: profErr } = await supabase.from('profiles').insert({
        id: existingAuthAdmin.id,
        company_id: companyId,
        name: 'Admin Ferreira',
        role: 'master',
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        active: true,
      });
      results.push(profErr ? `✗ Create profile: ${profErr.message}` : `✓ Created profile for auth admin`);
    } else {
      // Update existing profile
      const { error: updErr } = await supabase.from('profiles').update({
        role: 'master',
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        active: true,
        name: existingProfile.name || 'Admin Ferreira',
      }).eq('id', existingAuthAdmin.id);
      results.push(updErr ? `✗ Update profile: ${updErr.message}` : `✓ Updated profile for auth admin`);
    }
  } else {
    // Create new auth user
    results.push(`Creating new auth user: ${adminEmail}`);
    const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: 'admin123',
      email_confirm: true,
      user_metadata: { name: 'Admin Ferreira', company_id: companyId, role: 'master' }
    });

    if (createErr) {
      results.push(`✗ Create auth user: ${createErr.message}`);
      // Fallback: try to use the first existing profile with just username/password
      const firstProfile = profiles?.[0];
      if (firstProfile) {
        const { error: updErr } = await supabase.from('profiles').update({
          username: 'admin',
          password: bcrypt.hashSync('admin123', 10),
          active: true,
          role: 'master',
        }).eq('id', firstProfile.id);
        results.push(updErr ? `✗ Fallback update: ${updErr.message}` : `✓ Fallback: set first profile as admin (username-only login)`);
        adminProfileId = firstProfile.id;
      }
    } else {
      adminProfileId = newAuth.user.id;
      results.push(`✓ Created auth user: ${newAuth.user.id}`);

      // Create or update profile
      const existingProfile = profiles?.find(p => p.id === newAuth.user.id);
      if (!existingProfile) {
        const { error: profErr } = await supabase.from('profiles').insert({
          id: newAuth.user.id,
          company_id: companyId,
          name: 'Admin Ferreira',
          role: 'master',
          username: 'admin',
          password: bcrypt.hashSync('admin123', 10),
          active: true,
        });
        results.push(profErr ? `✗ Create profile: ${profErr.message}` : `✓ Created profile`);
      }
    }
  }

  res.json({
    success: true,
    results,
    adminProfileId,
    message: 'Login with: admin / admin123 (fallback username/password login)',
    note: 'If Supabase Auth login fails, the system uses the username/password stored in profiles table as fallback.'
  });
});

// Route for manual cleanup of orphaned financial records
app.post('/api/maintenance/cleanup-financial', requireAdmin, async (req: any, res) => {
  try {
    const { data: listAcc } = await supabase
      .from('accounts_receivable')
      .select('id, estimate_id, valor_pago')
      .eq('company_id', req.user.companyId);

    if (!listAcc || listAcc.length === 0) return res.json({ message: 'Nenhuma conta encontrada para limpeza.' });

    const { data: estimates } = await supabase
      .from('estimates')
      .select('id, status')
      .eq('company_id', req.user.companyId);

    const estMap = new Map((estimates || []).map(e => [e.id, e.status]));
    const activeStatuses = ['approved', 'partial', 'paid', 'in_production', 'finished', 'accepted'];

    const toDelete = listAcc.filter(acc => {
      const status = estMap.get(acc.estimate_id);
      const hasNoPayment = parseFloat(acc.valor_pago || '0') === 0;
      return (!status || !activeStatuses.includes(status)) && hasNoPayment;
    });

    if (toDelete.length === 0) return res.json({ message: 'Nenhuma conta órfã sem pagamento encontrada.' });

    const idsToDelete = toDelete.map(acc => acc.id);
    const { error: delErr } = await supabase
      .from('accounts_receivable')
      .delete()
      .in('id', idsToDelete);

    if (delErr) throw delErr;

    res.json({
      message: `Limpeza concluída! ${idsToDelete.length} registros financeiros órfãos removidos.`,
      deletedCount: idsToDelete.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// AUTH Routes
// =====================



app.post('/api/login', async (req, res) => {
  if (!checkRateLimit(req.ip, 10)) {
    console.warn(`[SECURITY] Login rate limit exceeded for IP: ${req.ip}`);
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 1 minuto.' });
  }

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

  console.log(`[AUTH_LOGIN_ATTEMPT] User: ${username} | IP: ${req.ip}`);

  // Use a simulated email for Supabase Auth if it's a simple username
  const email = username.includes('@') ? username : `${username}@ferreiracalhas.com`;

  try {
    // Create a temporary client to avoid mutating the global service-role client's state with the user session
    const tempClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await tempClient.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      // Secure Fallback for users not yet in Supabase Auth but in profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profile && profile.password && bcrypt.compareSync(password, profile.password)) {
        const sessionData = Buffer.from(JSON.stringify({ userId: profile.id })).toString('base64');
        res.cookie('session', sessionData, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
        return res.json({ success: true, role: profile.role, name: profile.name, companyId: profile.company_id, id: profile.id });
      }

      console.warn(`[AUTH_FAILED] User: ${username} | Reason: ${authError.message}`);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const userId = authData.user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, name, company_id')
      .eq('id', userId)
      .single();

    if (!profile) return res.status(401).json({ error: 'Perfil não encontrado no sistema' });

    const sessionData = Buffer.from(JSON.stringify({ userId: profile.id })).toString('base64');
    res.cookie('session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({ success: true, role: profile.role, name: profile.name, companyId: profile.company_id, id: profile.id });

  } catch (err) {
    console.error('[AUTH_EXCEPTION]', err);
    res.status(500).json({ error: 'Erro interno ao realizar login' });
  }
});

app.post('/api/auth/google/sync', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Token do Google ausente' });

  // Debug de Variáveis (Apenas presença, sem mostrar o valor por segurança)
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      error: 'Erro de Configuração: As chaves do Supabase não foram encontradas no servidor do Vercel.',
      debug: { hasUrl: !!supabaseUrl, hasService: !!supabaseServiceKey, hasAnon: !!supabaseAnonKey }
    });
  }

  try {
    const tempClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Obtém o usuário a partir do Token Google de forma segura
    const { data, error: authError } = await tempClient.auth.getUser(access_token);
    const user = data?.user;

    if (authError || !user) {
      console.error('[SYNC_ERROR] Auth Failure:', authError);
      return res.status(401).json({ error: 'Sua sessão do Google expirou ou é inválida. Tente logar novamente.' });
    }

    // Verifica se já existe o profile vinculando ao banco real
    let { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('id, role, name, company_id')
      .eq('id', user.id)
      .single();

    console.log(`[SYNC_DEBUG] Perfil encontrado: ${!!profile} | UserID: ${user.id}`);
    if (profile) console.log(`[SYNC_DEBUG] Perfil Data: Role=${profile.role}, Company=${profile.company_id}`);

    let companyId = profile?.company_id;
    let role = profile?.role || 'master';

    if (!profile) {
      // Cria a nova Company primeiro
      const { data: newCompany, error: companyErr } = await supabase
        .from('companies')
        .insert([{ name: `${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'} - Company` }])
        .select()
        .single();

      if (companyErr) throw companyErr;
      companyId = newCompany.id;

      // Popular produtos padrão para nova empresa (Item 1 & 3)
      await seedDefaultProducts(companyId);

      // Cria o novo Profile daquele usuário (Master da própria company)
      const { data: newProfile, error: profileErr } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          username: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0],
          role: 'master',
          company_id: companyId
        }])
        .select()
        .single();

      if (profileErr) throw profileErr;
      profile = newProfile;
    } else if (!companyId) {
      // Usuário até existe (ex: testou o login normal sem company) mas sem `company_id`
      const { data: newCompany, error: companyErr } = await supabase
        .from('companies')
        .insert([{ name: `${profile.name || user.email?.split('@')[0] || 'Usuário'} - Company` }])
        .select()
        .single();

      if (companyErr) throw companyErr;
      companyId = newCompany.id;

      // Popular produtos padrão para nova empresa (Item 1 & 3)
      await seedDefaultProducts(companyId);

      const { data: updateProfile, error: updateErr } = await supabase
        .from('profiles')
        .update({ company_id: companyId, role: 'master' })
        .eq('id', user.id)
        .select()
        .single();

      if (updateErr) throw updateErr;
      profile = updateProfile;
      role = 'master';
    }

    // --- GARANTIA DE SEED E ROLE ---
    // O seed roda em background (fire-and-forget) para não travar o Vercel (timeout 10s)
    if (profile && profile.company_id) {
      // Seed em background - não bloqueia a resposta
      seedDefaultProducts(profile.company_id).catch(e => console.error('[SEED_BG_ERROR]', e));

      // Garantir role master (o Trigger cria como 'admin')
      if (profile.role === 'admin') {
        const { data: upgradedProfile } = await supabase
          .from('profiles')
          .update({ role: 'master' })
          .eq('id', profile.id)
          .select()
          .single();
        if (upgradedProfile) profile = upgradedProfile;
      }
    }

    // Responde imediatamente com o cookie de sessão
    const sessionData = Buffer.from(JSON.stringify({ userId: profile.id })).toString('base64');
    res.cookie('session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, role: profile.role, name: profile.name, companyId: profile.company_id, id: profile.id });

  } catch (err: any) {
    console.error('[GOOGLE_SYNC_ERROR]', err);
    res.status(500).json({ error: 'Erro interno no banco do sync do Google: ' + err.message });
  }
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('session');
  res.clearCookie('admin_session');
  res.json({ success: true });
});

app.get('/api/auth/check', async (req, res) => {
  const user = await parseSession(req);
  // Also support legacy cookie
  const legacyCookie = req.cookies.admin_session;
  if (user) {
    res.json({ authenticated: true, role: user.role, name: user.name || user.username, id: user.id });
  } else if (legacyCookie === 'authenticated') {
    // Legacy support: get admin user from profiles table
    const { data: adminUser } = await supabase.from('profiles').select('id,username,role,name').eq('username', 'admin').single();
    if (adminUser) {
      res.json({ authenticated: true, role: adminUser.role, name: adminUser.name || adminUser.username, id: adminUser.id });
    } else {
      res.json({ authenticated: false });
    }
  } else {
    res.json({ authenticated: false });
  }

});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  res.json(req.user);
});

app.post('/api/auth/change-password', authenticate, async (req: any, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });
  const hashed = bcrypt.hashSync(newPassword, 10);
  await supabase.from('profiles').update({ password: hashed }).eq('id', req.user.id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});


// =====================
// USERS Routes (Multi-tenant)
// =====================
app.get('/api/users', requireAdmin, async (req: any, res) => {
  const { data, error } = await supabase.from('profiles').select('id,username,name,email,phone,role,active,created_at')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/users', requireAdmin, async (req: any, res) => {
  const { username, password, name, email, phone, role } = req.body;
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

app.put('/api/users/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  const { name, email, phone, active, role, password } = req.body;
  const updateData: any = { name, email, phone, active };
  if (role !== undefined && req.user.role === 'master') updateData.role = role;
  if (password) updateData.password = bcrypt.hashSync(password, 10);
  const { data, error } = await supabase.from('profiles').update(updateData)
    .eq('id', id).eq('company_id', req.user.companyId).select('id,username,name,email,phone,role,active').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/users/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
  await supabase.from('profiles').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// CLIENTS Routes (SaaS V2 Map: /api/clients -> clients table)
// =====================
app.get('/api/clients', authenticate, async (req: any, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/clients', authenticate, async (req: any, res) => {
  const { name, email, phone, document, address } = req.body;

  // Backend Validation
  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (email && !email.includes('@')) return res.status(400).json({ error: 'E-mail inválido' });
  if (phone && phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Telefone inválido (mínimo 10 dígitos)' });

  const { data, error } = await supabase.from('clients').insert({
    company_id: req.user.companyId,
    name, email, phone, document, address
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/clients/:id', authenticate, async (req: any, res) => {
  const { name, email, phone, document, address } = req.body;

  // Backend Validation
  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (email && !email.includes('@')) return res.status(400).json({ error: 'E-mail inválido' });
  if (phone && phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Telefone inválido (mínimo 10 dígitos)' });

  const { data, error } = await supabase.from('clients')
    .update({ name, email, phone, document, address })
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/clients/:id', authenticate, async (req: any, res) => {
  await supabase.from('clients').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});


// =====================
// HARNESS ALIASES (Compatibility for Test Harness UI)
// =====================
// Redirects to map the Harness names to existing logic
// GET /api/products and POST /api/products are handled directly below (search for PRODUCTS Routes)

app.get('/api/estimates', authenticate, (req, res) => res.redirect(307, '/api/quotes'));
app.post('/api/estimates', authenticate, (req, res) => res.redirect(307, '/api/quotes'));

app.get('/api/payments', requireAdmin, (req, res) => res.redirect(307, '/api/financial'));

// Raw POST for Test Harness Compatibility
app.post('/api/payments', requireAdmin, async (req: any, res) => {
  const { amount, status, payment_method } = req.body;
  if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Valor inválido' });

  const { data, error } = await supabase.from('payments').insert({
    company_id: req.user.companyId,
    amount: parseFloat(amount),
    payment_method: payment_method || 'teste',
    status: status || 'confirmed',
    confirmed_by: req.user.id,
    confirmed_at: new Date().toISOString()
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// =====================
// PROFILES Routes (SaaS V2: Scoped to Company)
// =====================
app.get('/api/users', requireAdmin, async (req: any, res) => {
  const { data, error } = await supabase.from('profiles')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/users', requireAdmin, async (req: any, res) => {
  if (!checkRateLimit(req.ip, 10)) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 1 minuto.' });

  const { username, password, name, role, phone } = req.body;
  const email = username?.includes('@') ? username : `${username}@ferreiracalhas.com`;

  // Security: Only master can assign master role
  if (role === 'master' && req.user.role !== 'master') {
    return res.status(403).json({ error: 'Apenas master pode criar outros masters' });
  }

  const companyId = req.user.companyId;

  try {
    // 1. Create User in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, company_id: companyId, role: role || 'user' }
    });

    if (authError) {
      console.error(`[USER_CREATE_ERROR] Auth failure: ${authError.message}`);
      return res.status(400).json({ error: authError.message });
    }

    const newUser = authData.user!;

    // 2. Use UPSERT to handle both new profiles and existing ones (if trigger already fired)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: newUser.id,
        name: name || username,
        role: role || 'user',
        company_id: companyId,
        phone: phone || ''
      })
      .select()
      .single();

    if (profileError) {
      console.error(`[USER_CREATE_ERROR] Profile sync failure: ${profileError.message}`);
      return res.status(500).json({ error: 'Erro ao sincronizar perfil do usuário' });
    }

    res.json(profile);

  } catch (err) {
    console.error('[USER_CREATE_EXCEPTION]', err);
    res.status(500).json({ error: 'Erro interno ao criar usuário' });
  }
});

app.put('/api/users/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  const { name, role, password } = req.body;

  // Security: Only master can assign master role
  if (role === 'master' && req.user.role !== 'master') {
    return res.status(403).json({ error: 'Apenas master pode alterar para master' });
  }

  // Se houver troca de senha através do painel admin
  if (password && password.length >= 6) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, { password });
    if (authError) return res.status(400).json({ error: authError.message });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ name, role })
    .eq('id', id)
    .eq('company_id', req.user.companyId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/users/:id', requireMaster, async (req: any, res) => {
  const id = req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });

  await supabase.from('profiles').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});


// =====================
// SETTINGS Routes (SaaS V2: Scoped to Company)
// =====================
// =====================
// SETTINGS Routes (SaaS V2)
// =====================
app.get('/api/settings', async (req: any, res) => {
  console.log('[DEBUG] Request to /api/settings hit');
  // Publicly accessible - tries to find company from session, otherwise uses first company

  let companyId: string | null = null;
  const user = await parseSession(req);
  if (user) {
    companyId = user.companyId;
  } else {
    // Default to the first company in the system for public visitors
    const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
    if (firstCompany) companyId = firstCompany.id;
  }

  if (!companyId) return res.json({}); // Return empty object if no company exists yet

  const { data: company, error } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', companyId)
    .single();

  if (error || !company) return res.json({});
  res.json(company.settings || {});
});


app.post('/api/settings', requireAdmin, upload.fields([{ name: 'logo' }, { name: 'heroImage' }, { name: 'pixQrCode' }]), async (req: any, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const newSettings = req.body;

  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', req.user.companyId)
    .single();

  const currentSettings = company?.settings || {};
  const updatedSettings = { ...currentSettings, ...newSettings };

  if (files?.logo?.[0]) updatedSettings.logoUrl = `/uploads/${files.logo[0].filename}`;
  if (files?.heroImage?.[0]) updatedSettings.heroImageUrl = `/uploads/${files.heroImage[0].filename}`;
  if (files?.pixQrCode?.[0]) updatedSettings.pixQrCodeUrl = `/uploads/${files.pixQrCode[0].filename}`;

  await supabase.from('companies').update({ settings: updatedSettings }).eq('id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// ADMIN DATA Route
// =====================
app.get('/api/admin/data', requireAdmin, async (req: any, res) => {
  try {
    const [companyRes, servicesRes, postsRes, galleryRes, testimonialsRes, estimatesRes, productsRes, receivablesRes, prodOrdersRes, creditsRes] =
      await Promise.all([
        supabase.from('companies').select('settings').eq('id', req.user.companyId).single(),
        supabase.from('services').select('*').eq('company_id', req.user.companyId),
        supabase.from('posts').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
        supabase.from('gallery').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
        supabase.from('testimonials').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
        supabase.from('estimates').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('company_id', req.user.companyId).order('name', { ascending: true }),
        supabase.from('accounts_receivable').select('id, estimate_id, status, valor_pago, valor_restante, created_at').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
        supabase.from('production_orders').select('estimate_id, status').or(`company_origin_id.eq.${req.user.companyId},company_target_id.eq.${req.user.companyId}`),
        supabase.from('credits').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false }),
      ]);

    let profilesRes: any = null;
    if (req.user.role === 'master' || req.user.role === 'admin') {
      profilesRes = await supabase.from('profiles').select('*').eq('company_id', req.user.companyId).order('created_at', { ascending: false });
    }

    if (estimatesRes.error) console.error('Error fetching estimates:', estimatesRes.error);
    if (productsRes.error) console.error('Error fetching products:', productsRes.error);
    if (profilesRes?.error) console.error('Error fetching profiles:', profilesRes.error);
    const settings = companyRes.data?.settings || {};

    const allReceivables = (receivablesRes.data || []);
    const allProdOrders = (prodOrdersRes.data || []);
    const allCredits = (creditsRes.data || []);

    const estimates = (estimatesRes.data || []).map(q => {
      let clientName = (Array.isArray(q.profiles) ? q.profiles[0]?.name : q.profiles?.name) || 'Cliente';
      let notes = q.notes || '';
      while (notes.startsWith('[CLIENT: ')) {
        const match = notes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
        if (match) { clientName = match[1]; notes = (match[2] || '').trim(); } else break;
      }

      const qId = String(q.id).toLowerCase();

      // 1. Encontrar registro financeiro principal
      const recs = allReceivables.filter(r => String(r.estimate_id).toLowerCase() === qId);
      const rec = recs.find(r => !['converted_to_credit', 'canceled', 'cancelled'].includes(r.status)) || recs[0];

      // 2. Encontrar CRÉDITOS disponíveis vindos de versões anteriores (Nova Versão)
      const creditsForThis = allCredits.filter(c =>
        (c.estimate_id_origem && String(c.estimate_id_origem).toLowerCase() === String(q.parent_estimate_id).toLowerCase()) &&
        c.status === 'disponivel'
      );
      const totalCredit = creditsForThis.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);

      // 3. Cálculos Dinâmicos
      const valorTotal = Number(q.final_amount || q.total_amount || 0);
      const valorJaPagoEmConta = Number(rec?.valor_pago || 0);

      const totalSistematizado = valorJaPagoEmConta + totalCredit;
      const saldoReal = Math.max(0, valorTotal - totalSistematizado);

      const prod = allProdOrders.find(p => String(p.estimate_id).toLowerCase() === qId);

      // Status Financeiro Dinâmico
      let finStatus = rec?.status || (totalSistematizado > 0 ? 'parcial' : 'pendente');
      if (totalSistematizado > 0 && saldoReal < 0.01) finStatus = 'pago';

      return {
        ...q,
        clientName,
        fin_status: finStatus,
        prod_status: prod ? prod.status : null,
        fin_remaining: saldoReal,
        fin_paid: totalSistematizado,
        fin_id: rec ? rec.id : null,
        createdAt: q.created_at,
        totalValue: valorTotal,
        finalValue: valorTotal
      };
    });

    res.json({
      settings,
      services: servicesRes.data || [],
      posts: postsRes.data || [],
      gallery: galleryRes.data || [],
      testimonials: testimonialsRes.data || [],
      quotes: estimates,
      inventory: (productsRes.data || []).map(p => ({
        ...p,
        price: p.base_cost,
        stock_quantity: p.stock_quantity || 0,
        availableM2: p.stock_quantity || 0
      })),
      users: (profilesRes?.data || []).map(u => ({
        ...u,
        createdAt: u.created_at
      })),
      currentUser: req.user,
    });
  } catch (error) {
    console.error('Error fetching admin data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =====================
// SERVICES Routes (Multi-tenant)
// =====================
app.get('/api/services', async (req: any, res) => {
  let companyId: string | null = null;
  const user = await parseSession(req);
  if (user) companyId = user.companyId;
  else {
    const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
    if (firstCompany) companyId = firstCompany.id;
  }

  if (!companyId) return res.json([]);

  const { data } = await supabase.from('services').select('*').eq('company_id', companyId);
  res.json(data || []);
});


app.post('/api/services', requireAdmin, upload.single('image'), async (req: any, res) => {
  try {
    const { title, description } = req.body;
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file);
    }
    const { data, error } = await supabase.from('services').insert({
      title, description, imageUrl, company_id: req.user.companyId
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services/delete/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { data: item } = await supabase.from('services').select('imageUrl')
    .eq('id', id).eq('company_id', req.user.companyId).single();
  if (item?.imageUrl?.startsWith('/uploads/')) {
    const fp = path.join(process.cwd(), item.imageUrl);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) { }
  }
  await supabase.from('services').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

app.post('/api/services/:id/home-image', requireAdmin, upload.single('homeImage'), async (req: any, res) => {
  const id = req.params.id; // UUID
  const homeImageUrl = `/uploads/${req.file!.filename}`;
  await supabase.from('services').update({ homeImageUrl })
    .eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true, homeImageUrl });
});

// =====================
// POSTS Routes (Multi-tenant)
// =====================
app.get('/api/posts', async (req: any, res) => {
  let companyId: string | null = null;
  const user = await parseSession(req);
  if (user) companyId = user.companyId;
  else {
    const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
    if (firstCompany) companyId = firstCompany.id;
  }

  if (!companyId) return res.json([]);

  const { data } = await supabase.from('posts').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  res.json(data || []);
});


app.post('/api/posts', requireAdmin, upload.single('image'), async (req: any, res) => {
  try {
    const { title, content } = req.body;
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToSupabase(req.file);
    }
    const { data, error } = await supabase.from('posts').insert({
      title, content, imageUrl, company_id: req.user.companyId
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/delete/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { data: item } = await supabase.from('posts').select('imageUrl')
    .eq('id', id).eq('company_id', req.user.companyId).single();
  if (item?.imageUrl?.startsWith('/uploads/')) {
    const fp = path.join(process.cwd(), item.imageUrl);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) { }
  }
  await supabase.from('posts').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// GALLERY Routes (Multi-tenant)
// =====================
app.get('/api/gallery', async (req: any, res) => {
  let companyId: string | null = null;
  const user = await parseSession(req);
  if (user) companyId = user.companyId;
  else {
    const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
    if (firstCompany) companyId = firstCompany.id;
  }

  if (!companyId) return res.json([]);

  const { serviceId } = req.query;
  let query = supabase.from('gallery').select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (serviceId) query = query.eq('service_id', serviceId);
  const { data } = await query;
  res.json(data || []);
});


app.post('/api/gallery', requireAdmin, upload.array('images'), async (req: any, res) => {
  try {
    const { description, serviceId } = req.body;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'Pelo menos uma imagem é necessária' });

    const parsedServiceId = serviceId ? parseInt(String(serviceId), 10) : null;

    // Upload de múltiplos arquivos para o Supabase
    const imageLinks = await Promise.all(
      files.map(file => uploadToSupabase(file))
    );

    const items = imageLinks.map(url => ({
      imageUrl: url,
      description: description || '',
      serviceId: parsedServiceId,
      company_id: req.user.companyId
    }));

    const { data, error } = await supabase.from('gallery').insert(items).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/delete/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  await supabase.from('gallery').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

app.post('/api/gallery/bulk-delete', requireAdmin, async (req: any, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs obrigatórios' });
  const numericIds = ids.map((id: any) => parseInt(id)).filter(id => !isNaN(id));

  const { data: items } = await supabase.from('gallery').select('imageUrl')
    .in('id', numericIds).eq('company_id', req.user.companyId);

  for (const item of items || []) {
    if (item.imageUrl?.startsWith('/uploads/')) {
      const fp = path.join(process.cwd(), item.imageUrl);
      if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) { }
    }
  }
  await supabase.from('gallery').delete().in('id', numericIds).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// TESTIMONIALS Routes (Multi-tenant)
// =====================
app.get('/api/testimonials', async (req: any, res) => {
  let companyId: string | null = null;
  const user = await parseSession(req);
  if (user) companyId = user.companyId;
  else {
    const { data: firstCompany } = await supabase.from('companies').select('id').limit(1).single();
    if (firstCompany) companyId = firstCompany.id;
  }
  if (!companyId) return res.json([]);
  const { data } = await supabase.from('testimonials').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/api/testimonials', requireAdmin, async (req: any, res) => {
  const { author, content, rating } = req.body;
  const { data, error } = await supabase.from('testimonials').insert({
    author, content, rating: rating || 5, company_id: req.user.companyId
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/testimonials/delete/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id; // UUID
  await supabase.from('testimonials').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});


// =====================
// PRODUCTS Routes (TestHarness specific /api/products)
// =====================

// Temp migration endpoint (safe to call multiple times)
app.post('/api/migrate/type-product', requireMaster, async (req: any, res) => {
  try {
    // Add column if not exists
    await supabase.rpc('exec_ddl' as any, {
      sql: `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type_product TEXT NOT NULL DEFAULT 'product'`
    });

    // Fallback: try inserting a dummy row to detect if column exists
    const { data: testData } = await supabase.from('products')
      .select('id, type_product').limit(1);

    if (testData !== null) {
      res.json({ success: true, message: 'Column type_product already exists or was added.' });
    } else {
      res.status(500).json({ error: 'Could not verify migration. Run SQL manually in Supabase dashboard.' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products', requireAdmin, async (req: any, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[API] Error fetching products:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log(`[API] /api/products: fetched ${data?.length || 0} items for company ${req.user.companyId}`);
  if (data && data.length > 0) {
    console.log('[API] Sample product record keys:', Object.keys(data[0]).join(', '));
    console.log('[API] Sample product record data:', JSON.stringify(data[0]));
  }

  const mappedObj = (data || []).map(p => ({
    ...p,
    price: p.base_cost, // Backward compatibility
    base_cost: p.base_cost,
    stock_quantity: p.stock_quantity || 0,
    type_product: p.type_product || p.tipo_produto || 'product',
    tipo_produto: p.tipo_produto || p.type_product || 'product',
    _diagnostics: {
      server_keys: data?.[0] ? Object.keys(data[0]) : []
    }
  }));
  res.json(mappedObj);
});

app.post('/api/products', requireAdmin, async (req: any, res) => {
  const { name, price, stock_quantity, description, type_product, unit } = req.body;
  if (!name || name.trim().length === 0) return res.status(400).json({ error: 'Nome é obrigatório' });

  const finalType = validTypes.includes(type_product) ? type_product : (validTypes.includes(req.body.tipo_produto) ? req.body.tipo_produto : 'product');
  const finalPrice = parseFloat(price) || 0;
  const finalUnit = unit || 'm2';

  console.log('[API] Creating product:', { name, finalType, finalPrice, stock_quantity });

  const insertPayload: any = {
    company_id: req.user.companyId,
    name,
    description: description || name,
    base_cost: finalPrice,
    stock_quantity: parseFloat(stock_quantity) || 0,
    type_product: finalType,
    unit: finalUnit,
  };

  const { data, error } = await supabase.from('products').insert(insertPayload).select().single();

  if (error) {
    console.error('[API] Error creating product:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ...data, price: data.base_cost, type_product: data.type_product || 'product' });
});

app.put('/api/products/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  const { name, price, stock_quantity, type_product, unit, description } = req.body;

  console.log('[DEBUG_PUT] Received payload:', JSON.stringify(req.body));
  console.log('[DEBUG_PUT] type_product from body:', type_product);
  console.log('[DEBUG_PUT] validTypes:', JSON.stringify(validTypes));

  const finalType = validTypes.includes(type_product) ? type_product : (validTypes.includes(req.body.tipo_produto) ? req.body.tipo_produto : 'product');

  console.log('[DEBUG_PUT] finalType determined:', finalType);
  const finalPrice = parseFloat(price) || 0;
  const finalUnit = unit || 'm2';

  const updatePayload: any = {
    name,
    description: description || name,
    base_cost: finalPrice,
    stock_quantity: parseFloat(stock_quantity) || 0,
    type_product: finalType,
    unit: finalUnit,
  };

  const { data, error } = await supabase.from('products').update(updatePayload)
    .eq('id', id).eq('company_id', req.user.companyId).select().single();

  if (error) {
    console.error('[API] Error updating product:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('[API] Product updated successfully. Record keys:', Object.keys(data).join(', '));
  console.log('[API] Product updated successfully. Data:', JSON.stringify(data));
  res.json({ ...data, price: data.base_cost, type_product: data.type_product || 'product' });
});

app.delete('/api/products/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  await supabase.from('products').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// BEND LIBRARY Routes
// =====================
app.get('/api/bend-library', authenticate, async (req: any, res) => {
  const { productId } = req.query;
  let query = supabase.from('bend_library')
    .select('*')
    .eq('company_id', req.user.companyId);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error } = await query.order('use_count', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/bend-library', authenticate, async (req: any, res) => {
  const { productId, risks, roundedWidthCm, svgDataUrl } = req.body;
  console.log('[bend-library POST] companyId:', req.user?.companyId, '| productId:', productId, '| risks count:', risks?.length, '| roundedWidthCm:', roundedWidthCm);

  if (!risks || !Array.isArray(risks)) {
    console.log('[bend-library POST] ERROR: risks missing or not array');
    return res.status(400).json({ error: 'Riscos obrigatórios' });
  }

  if (!roundedWidthCm && roundedWidthCm !== 0) {
    console.log('[bend-library POST] ERROR: roundedWidthCm missing');
    return res.status(400).json({ error: 'roundedWidthCm obrigatório' });
  }

  // Check for uniqueness based on risk directions only
  const directions = risks.map((r: any) => r.direction).join('|');
  console.log('[bend-library POST] checking duplicate for directions:', directions, '| productId:', productId);

  const { data: existing, error: existingErr } = await supabase.from('bend_library')
    .select('*')
    .eq('company_id', req.user.companyId)
    .eq('product_id', productId || null);

  if (existingErr) {
    console.log('[bend-library POST] ERROR fetching existing:', existingErr.message);
  }

  const duplicate = (existing || []).find((e: any) => {
    const eDirs = (e.risks || []).map((r: any) => r.direction).join('|');
    return eDirs === directions;
  });

  if (duplicate) {
    console.log('[bend-library POST] found duplicate id:', duplicate.id, '- incrementing use_count');
    const { data: updatedDup, error: updErr } = await supabase.from('bend_library').update({
      use_count: (duplicate.use_count || 0) + 1,
      svg_data_url: svgDataUrl || duplicate.svg_data_url
    }).eq('id', duplicate.id).select().single();
    if (updErr) console.log('[bend-library POST] ERROR updating duplicate:', updErr.message);
    return res.json(updatedDup || duplicate);
  }

  console.log('[bend-library POST] inserting new bend_library entry...');
  const { data, error } = await supabase.from('bend_library').insert({
    company_id: req.user.companyId,
    product_id: productId || null,
    risks,
    rounded_width_cm: roundedWidthCm || 0,
    svg_data_url: svgDataUrl || null,
    use_count: 1
  }).select().single();

  if (error) {
    console.log('[bend-library POST] ERROR inserting:', error.message, error.details, error.hint);
    return res.status(500).json({ error: error.message });
  }
  console.log('[bend-library POST] SUCCESS - inserted id:', data?.id);
  res.json(data);
});



// =====================
// QUOTES Routes (SaaS V2 Map: /api/quotes -> estimates table)
// =====================
app.get('/api/quotes/pending-count', requireAdmin, async (req: any, res) => {
  const { count } = await supabase.from('estimates')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', req.user.companyId)
    .eq('status', 'pending');
  res.json({ count: count || 0 });
});

app.get('/api/quotes', authenticate, async (req: any, res) => {
  // 1. Buscar estimates
  let query = supabase.from('estimates')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (req.user.role === 'user') query = query.eq('client_id', req.user.id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const estimates = data || [];

  // Lógica de Expiração Automática (Reativa)
  const today = new Date();
  const expiredIds = estimates
    .filter(q => q.status === 'sent' && q.data_envio)
    .filter(q => {
      const dataEnvio = new Date(q.data_envio);
      const validade = q.validade_dias || 7;
      const dataExpiracao = new Date(dataEnvio);
      dataExpiracao.setDate(dataExpiracao.getDate() + validade);
      return today > dataExpiracao;
    })
    .map(q => q.id);

  if (expiredIds.length > 0) {
    console.log(`[EXPIRATION] Marcando ${expiredIds.length} orçamentos como expirados.`);
    // Atualização em background
    supabase.from('estimates')
      .update({ status: 'expired' })
      .in('id', expiredIds)
      .then(({ error }) => { if (error) console.error('[EXPIRATION_ERROR]', error); });

    // Atualiza o array local para refletir na resposta imediata
    estimates.forEach(q => { if (expiredIds.includes(q.id)) q.status = 'expired'; });
  }

  // 2. Buscar accounts_receivable e créditos em batch
  const estimateIds = estimates.map(q => q.id).filter(Boolean);
  const parentIds = estimates.map(q => q.parent_estimate_id).filter(Boolean);

  let receivablesMap: Record<string, any> = {};
  let creditsMap: Record<string, any> = {};

  const [resAR, resCredits] = await Promise.all([
    estimateIds.length > 0
      ? supabase.from('accounts_receivable').select('*').eq('company_id', req.user.companyId).in('estimate_id', estimateIds)
      : Promise.resolve({ data: [] }),
    parentIds.length > 0
      ? supabase.from('credits').select('*').eq('company_id', req.user.companyId).in('estimate_id_origem', parentIds).eq('status', 'disponivel')
      : Promise.resolve({ data: [] })
  ]);

  (resAR.data || []).forEach(r => {
    // Se houver mais de uma CR (raro), pegamos a mais recente que não esteja cancelada
    if (!receivablesMap[r.estimate_id] || !['cancelled', 'canceled', 'converted_to_credit'].includes(r.status)) {
      receivablesMap[r.estimate_id] = r;
    }
  });
  (resCredits.data || []).forEach(c => creditsMap[c.estimate_id_origem] = c);

  // 3. Buscar production_orders
  const { data: prodOrders } = await supabase.from('production_orders').select('*').in('estimate_id', estimateIds);
  const prodOrdersMap: Record<string, any> = {};
  (prodOrders || []).forEach(po => prodOrdersMap[po.estimate_id] = po);

  // 4. Combinar
  const mapped = estimates.map(q => {
    let clientName = (Array.isArray(q.profiles) ? q.profiles[0]?.name : q.profiles?.name) || 'Cliente';
    let notes = q.notes || '';
    while (notes.startsWith('[CLIENT: ')) {
      const match = notes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
      if (match) { clientName = match[1]; notes = (match[2] || '').trim(); }
      else break;
    }

    const ar = receivablesMap[q.id] || null;
    const credit = creditsMap[q.parent_estimate_id] || null;
    const po = prodOrdersMap[q.id] || null;

    const fin_status = ar?.status || null;
    const fin_remaining = ar !== null ? parseFloat(ar.valor_restante ?? '0') : null;
    const fin_paid = ar !== null ? parseFloat(ar.valor_pago ?? '0') : 0;
    const fin_total = ar !== null ? parseFloat(ar.valor_total ?? '0') : 0;
    const fin_id = ar?.id || null;
    const fin_credit = credit ? parseFloat(credit.valor || '0') : 0;

    return {
      ...q,
      clientName,
      notes,
      createdAt: q.created_at,
      totalValue: q.total_amount || 0,
      finalValue: q.final_amount || 0,
      bends: [],
      fin_status,
      fin_remaining,
      fin_paid,
      fin_total,
      fin_id,
      fin_credit,
      production_order: po
    };
  });

  res.json(mapped);
});

app.post('/api/quotes', authenticate, async (req: any, res) => {
  const { clientName, bends, notes, totalValue: passedTotalValue, adminCreated, clientId, pricePerM2Override, costPerM2Override } = req.body;

  // Fetch settings from company
  const { data: company } = await supabase.from('companies').select('settings').eq('id', req.user.companyId).single();
  const settings = company?.settings || {};
  const basePrice = parseFloat(pricePerM2Override || settings.pricePerM2 || '50');

  const costPerM2 = parseFloat(costPerM2Override || settings.costPerM2 || '0');
  let totalValue = 0;
  let totalCost = 0;
  if (bends && Array.isArray(bends)) {
    for (const b of bends) {
      if (b.productType === 'service') {
        totalValue += (parseFloat(b.serviceValue) || 0) * (parseFloat(b.serviceQty) || 1);
      } else {
        const m2 = parseFloat(b.m2) || 0;
        totalValue += m2 * basePrice;
        totalCost += m2 * costPerM2;
      }
    }
  }

  if (adminCreated && passedTotalValue) totalValue = parseFloat(passedTotalValue);

  const discount = parseFloat(req.body.discount_amount) || 0;
  const finalValue = Math.max(0, totalValue - discount);
  const profit = finalValue - totalCost;

  // Map everything that is not an final status to 'draft' as it is the only one we know works in the DB check constraint.
  let finalStatus = (req.body.status === 'rascunho' || req.body.status === 'draft' || !req.body.status) ? 'draft' : req.body.status;
  if (!['draft', 'pending', 'approved', 'paid', 'cancelled', 'confirmed'].includes(finalStatus)) {
    finalStatus = 'pending';
  }


  const quoteNotes = clientName ? `[CLIENT: ${clientName}] ${notes || ''}` : (notes || '');

  const { data: estimate, error: eError } = await supabase.from('estimates').insert({
    company_id: req.user.companyId,
    client_id: clientId || null,
    total_amount: totalValue,
    discount_amount: discount,
    final_amount: finalValue,
    profit_amount: profit,
    price_per_m2: pricePerM2Override || null,
    cost_per_m2: costPerM2Override || null,
    notes: quoteNotes,
    status: finalStatus,
    is_grouped: req.body.isGrouped || false
  }).select().single();

  if (eError) return res.status(500).json({ error: eError.message });

  if (bends && Array.isArray(bends) && bends.length > 0) {
    const itemRows = bends.map((b: any) => {
      const isService = b.productType === 'service';
      const uPrice = isService ? (parseFloat(b.serviceValue) || 0) : basePrice;
      const tPrice = isService ? (uPrice * (parseFloat(b.serviceQty) || 1)) : ((parseFloat(b.m2) || 0) * basePrice);
      return {
        estimate_id: estimate.id,
        product_id: b.product_id || null,
        description: isService ? `[SERVICE] ${b.serviceDescription || 'Serviço'}` : `[BEND] ${JSON.stringify(b)}`,
        quantity: isService ? (parseFloat(b.serviceQty) || 1) : (parseFloat(b.m2) || 0),
        unit_price: uPrice,
        total_price: tPrice
      };
    });
    await supabase.from('estimate_items').insert(itemRows);
  }

  res.json(estimate);
});

app.put('/api/quotes/:id', authenticate, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { clientName, bends, notes, totalValue: passedTotalValue, adminCreated, clientId, pricePerM2Override, costPerM2Override } = req.body;

  // 🔴 REGRA RÍGIDA DE ALTERAÇÃO (BACKEND)
  const { data: currentEstimate } = await supabase.from('estimates').select('status, is_grouped').eq('id', id).single();
  const { data: existingAR } = await supabase.from('accounts_receivable').select('id').eq('estimate_id', id).not('status', 'in', '(\'cancelled\',\'canceled\')').maybeSingle();
  const { data: existingPO } = await supabase.from('production_orders').select('id, status').eq('estimate_id', id).maybeSingle();

  // Verificar se a produção REALMENTE começou (algum item concluído)
  const { data: piDone } = await supabase.from('production_items').select('id').eq('estimate_id', id).eq('concluido', true).limit(1);
  const hasItemsDone = (piDone && piDone.length > 0);

  const isEditRestrictedStatus = ['approved', 'partial', 'paid', 'in_production', 'canceled', 'expired'].includes(currentEstimate?.status || '');

  // Bloqueamos se houver Financeiro Ativo OU Produção com itens concluídos OR Status Restrito
  // Se houver apenas a Ordem de Produção (shell) mas nenhum item feito, permitimos editar e limpamos a PO anterior
  if (isEditRestrictedStatus || existingAR || hasItemsDone) {
    return res.status(403).json({ error: 'Este orçamento não pode mais ser alterado. Crie uma nova versão para fazer modificações.' });
  }

  // Se existir Ordem de Produção mas não tiver nada feito, limpamos para garantir sincronia com os novos itens do orçamento
  if (existingPO) {
    await supabase.from('production_items').delete().eq('estimate_id', id);
    await supabase.from('production_orders').delete().eq('estimate_id', id);
  }


  const { data: qInfo } = await supabase.from('estimates').select('company_id').eq('id', id).single();
  const cid = qInfo?.company_id || req.user.companyId;

  const { data: company } = await supabase.from('companies').select('settings').eq('id', cid).single();
  const settings = company?.settings || {};
  const basePrice = parseFloat(pricePerM2Override || settings.pricePerM2 || '50');

  const costPerM2 = parseFloat(costPerM2Override || settings.costPerM2 || '0');
  let totalValue = 0;
  let totalCost = 0;
  if (bends && Array.isArray(bends)) {
    for (const b of bends) {
      if (b.productType === 'service') {
        totalValue += (parseFloat(b.serviceValue) || 0) * (parseFloat(b.serviceQty) || 1);
      } else {
        const m2 = parseFloat(b.m2) || 0;
        totalValue += m2 * basePrice;
        totalCost += m2 * costPerM2;
      }
    }
  }
  if (adminCreated && passedTotalValue) totalValue = parseFloat(passedTotalValue);

  const discount = parseFloat(req.body.discount_amount) || 0;
  const finalValue = Math.max(0, totalValue - discount);
  const profit = finalValue - totalCost;

  let finalStatus = (req.body.status === 'rascunho' || req.body.status === 'draft' || !req.body.status) ? 'draft' : req.body.status;
  if (!['draft', 'pending', 'approved', 'paid', 'cancelled', 'confirmed'].includes(finalStatus)) {
    finalStatus = 'pending';
  }

  const quoteNotes = clientName ? `[CLIENT: ${clientName}] ${notes || ''}` : (notes || '');

  const { data: estimate, error: eError } = await supabase.from('estimates').update({
    client_id: clientId || null,
    total_amount: totalValue,
    discount_amount: discount,
    final_amount: finalValue,
    profit_amount: profit,
    price_per_m2: pricePerM2Override || null,
    cost_per_m2: costPerM2Override || null,
    notes: quoteNotes,
    status: finalStatus,
    is_grouped: req.body.isGrouped !== undefined ? !!req.body.isGrouped : (currentEstimate?.is_grouped || false)
  }).eq('id', id).eq('company_id', cid).select().single();

  if (eError) return res.status(500).json({ error: eError.message });

  await supabase.from('estimate_items').delete().eq('estimate_id', id);

  if (bends && Array.isArray(bends) && bends.length > 0) {
    const itemRows = bends.map((b: any) => {
      const isService = b.productType === 'service';
      const uPrice = isService ? (parseFloat(b.serviceValue) || 0) : basePrice;
      const tPrice = isService ? (uPrice * (parseFloat(b.serviceQty) || 1)) : ((parseFloat(b.m2) || 0) * basePrice);
      return {
        estimate_id: id,
        product_id: b.product_id || null,
        description: isService ? `[SERVICE] ${b.serviceDescription || 'Serviço'}` : `[BEND] ${JSON.stringify(b)}`,
        quantity: isService ? (parseFloat(b.serviceQty) || 1) : (parseFloat(b.m2) || 0),
        unit_price: uPrice,
        total_price: tPrice
      };
    });
    await supabase.from('estimate_items').insert(itemRows);
  }

  res.json(estimate);
});

// ====================================================================
// SALDO EM TEMPO REAL — Consultado ao clicar em "Registrar Pagamento"
// ====================================================================
app.get('/api/quotes/:id/balance', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;
  const { arId } = req.query; // Possível ID da AR vindo do frontend

  try {
    console.log(`[FIN_BALANCE] Buscando saldo para Estimate=${id}${arId ? `, AR=${arId}` : ''}`);

    if (arId) {
      const { data: arById } = await supabase
        .from('accounts_receivable')
        .select('id, valor_restante, status')
        .eq('id', arId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (arById && !['pago', 'cancelled'].includes(arById.status)) {
        const saldo = parseFloat(arById.valor_restante ?? '0');
        console.log(`[FIN_BALANCE] Encontrado por AR_ID=${arId} -> Saldo: ${saldo}`);
        return res.json({ saldo, source: 'ar_by_id' });
      }
    }

    const { data: arByEst } = await supabase
      .from('accounts_receivable')
      .select('id, valor_restante, status')
      .eq('estimate_id', id)
      .eq('company_id', companyId)
      .in('status', ['pendente', 'parcial', 'atrasado', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (arByEst) {
      const saldo = parseFloat(arByEst.valor_restante ?? '0');
      console.log(`[FIN_BALANCE] Encontrado por Estimate_ID=${id} -> Saldo: ${saldo}`);
      return res.json({ saldo, source: 'ar_by_estimate' });
    }

    const { data: est } = await supabase
      .from('estimates')
      .select('final_amount, total_amount, parent_estimate_id, client_id')
      .eq('id', id).eq('company_id', companyId).maybeSingle();

    if (!est) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const total = parseFloat(est.final_amount || est.total_amount || '0');
    let credit = 0;
    if (est.parent_estimate_id) {
      const { data: c } = await supabase
        .from('credits').select('valor')
        .eq('company_id', companyId)
        .eq('estimate_id_origem', est.parent_estimate_id)
        .eq('status', 'disponivel').maybeSingle();
      if (c) credit = parseFloat(c.valor || '0');
    }

    const saldo = Math.max(0, total - credit);
    console.log(`[FIN_BALANCE] Sem AR ativa para ${id}. Total=${total}, Crédito=${credit} -> Saldo=${saldo}`);
    return res.json({ saldo, source: 'no_ar_credit_applied', credit_applied: credit });
  } catch (err: any) {
    console.error(`[FIN_BALANCE_ERROR] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/quotes/:id', authenticate, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { data: estimate, error } = await supabase.from('estimates')
    .select('*, items:estimate_items(*, product:products(*))')
    .eq('id', id)
    .eq('company_id', req.user.companyId)
    .single();

  if (error || !estimate) return res.status(404).json({ error: 'Orçamento não encontrado' });
  if (req.user.role === 'user' && estimate.client_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  // Map to legacy format for frontend
  let clientName = 'Cliente';
  let cleanNotes = estimate.notes || '';
  while (cleanNotes.startsWith('[CLIENT: ')) {
    const match = cleanNotes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
    if (match) {
      clientName = match[1];
      cleanNotes = (match[2] || '').trim();
    } else {
      break;
    }
  }

  res.json({
    ...estimate,
    clientName,
    notes: cleanNotes,
    totalValue: estimate.total_amount || 0,
    finalValue: estimate.final_amount ?? estimate.total_amount ?? 0,
    bends: (estimate.items || []).map((i: any) => {
      if (i.description && i.description.startsWith('[BEND] ')) {
        try { return JSON.parse(i.description.substring(7)); } catch { return {}; }
      }
      return {};
    })
  });
});

app.get('/api/quotes/:id/bends', authenticate, async (req: any, res) => {
  const id = req.params.id;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return res.status(400).json({ error: 'ID de orçamento inválido' });

  const { data, error } = await supabase.from('estimate_items')
    .select('*')
    .eq('estimate_id', id);

  if (error) return res.status(500).json({ error: 'Erro interno ao buscar itens' });
  if (!data || data.length === 0) return res.json([]);

  const result = data.map((i: any) => {
    if (i.description && i.description.startsWith('[BEND] ')) {
      try { return { ...JSON.parse(i.description.substring(7)), id: i.id, product_id: i.product_id }; } catch { return {}; }
    }
    if (i.description && i.description.startsWith('[SERVICE] ')) {
      return {
        id: i.id,
        productType: 'service',
        serviceDescription: i.description.replace('[SERVICE] ', ''),
        serviceValue: i.unit_price,
        serviceQty: i.quantity,
        product_id: i.product_id,
        total_price: i.total_price
      };
    }
    return {};
  });

  res.json(result.filter(x => Object.keys(x).length > 0));
});

// ── Relatório HTML para o Cliente (linkável via WhatsApp) — PÚBLICO ──────────
// O UUID de 128 bits é praticamente impossível de adivinhar — seguro para compartilhar
app.get('/api/quotes/:id/client-report', async (req: any, res) => {
  const id = req.params.id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return res.status(400).send('ID inválido');

  // 1. Buscar orçamento + itens (sem filtro de company — endpoint público)
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*, items:estimate_items(*)')
    .eq('id', id)
    .single();

  if (error || !estimate) return res.status(404).send('Orçamento não encontrado');

  // 2. Extrair nome do cliente das notes
  let clientName = 'Cliente';
  let cleanNotes = estimate.notes || '';
  while (cleanNotes.startsWith('[CLIENT: ')) {
    const match = cleanNotes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
    if (match) { clientName = match[1]; cleanNotes = (match[2] || '').trim(); }
    else break;
  }

  // 3. Buscar settings da empresa pelo company_id do próprio orçamento
  const { data: company } = await supabase.from('companies').select('settings').eq('id', estimate.company_id).single();
  const s: any = (company?.settings) || {};

  // 4. Agregar itens para o cliente
  let items: any[] = [];
  if (estimate.is_grouped) {
    // Se for agrupado, não consolidamos tudo — mostramos por cômodo
    const groups: Record<string, any[]> = {};
    (estimate.items || []).forEach((item: any) => {
      let name = 'Fabricação';
      let gName = 'Geral';
      if (item.description?.startsWith('[BEND] ')) {
        try {
          const b = JSON.parse(item.description.substring(7));
          name = b.productName || 'Calha/Rufo';
          gName = b.group_name || 'Geral';
        } catch { }
      } else if (item.description?.startsWith('[SERVICE] ')) {
        name = item.description.replace('[SERVICE] ', '');
      }
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push({
        name,
        type: item.description?.startsWith('[SERVICE] ') ? 'service' : 'product',
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: parseFloat(item.total_price) || 0,
        unit: item.description?.startsWith('[BEND] ') ? 'm²' : 'un'
      });
    });
    // Flatten with group headers
    Object.entries(groups).forEach(([gName, gItems]) => {
      items.push({ isHeader: true, name: `🏠 ${gName}` });
      items.push(...gItems);
    });
  } else {
    // Se NÃO for agrupado, consolidamos itens iguais
    const groupedMap: Record<string, any> = {};
    (estimate.items || []).forEach((item: any) => {
      let name = 'Fabricação de Calha/Rufo';
      let unit = 'm²';
      let type = 'product';
      let quantity = 0;
      let total_price = parseFloat(item.total_price) || 0;
      let unit_price = parseFloat(item.unit_price) || 0;

      if (item.description?.startsWith('[BEND] ')) {
        try {
          const b = JSON.parse(item.description.substring(7));
          quantity = b.m2 || 0;
          name = b.productName || 'Calha/Rufo';
          unit = 'm²';
          type = 'product';
        } catch { quantity = parseFloat(item.quantity) || 0; }
      } else if (item.description?.startsWith('[SERVICE] ')) {
        name = item.description.replace('[SERVICE] ', '');
        unit = 'un';
        type = 'service';
        quantity = parseFloat(item.quantity) || 1;
      } else {
        quantity = parseFloat(item.quantity) || 0;
      }

      const key = `${name}-${unit_price}`;
      if (!groupedMap[key]) groupedMap[key] = { name, unit, type, quantity: 0, total_price: 0 };
      groupedMap[key].quantity += quantity;
      groupedMap[key].total_price += total_price;
    });
    items = Object.values(groupedMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }
  const totalAmount = parseFloat(estimate.total_amount) || 0;
  const discountAmount = parseFloat(estimate.discount_amount) || 0;
  const finalAmount = parseFloat(estimate.final_amount) || (totalAmount - discountAmount);
  const quoteNum = String(id).substring(0, 8).toUpperCase();
  const emissionDate = new Date(estimate.created_at).toLocaleDateString('pt-BR');

  // 5. Gerar HTML
  const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento #${quoteNum} — ${s.reportCompanyName || 'Orçamento'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root{--brand:#2563eb;--brand-dark:#1e40af;--brand-soft:#f0f7ff;--text-main:#0f172a;--text-muted:#64748b;--border:#e2e8f0;--white:#ffffff}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact}
    body{font-family:'Inter',sans-serif;color:var(--text-main);line-height:1.6;margin:0;padding:0;background:#f1f5f9}
    @media print{body{background:white;padding:0}.no-print{display:none}.page{box-shadow:none!important;margin:0!important;width:100%!important;max-width:none!important;border-radius:0!important}}
    .page{max-width:840px;margin:40px auto;background:var(--white);padding:50px;border-radius:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,.1);position:relative;overflow:hidden}
    .page::before{content:'';position:absolute;top:0;left:0;width:100%;height:8px;background:linear-gradient(90deg,var(--brand),#60a5fa)}
    .header{display:flex;justify-content:space-between;align-items:start;margin-bottom:50px}
    .company-info{text-align:right}.company-info h1{margin:0;font-size:26px;font-weight:800;color:var(--brand);text-transform:uppercase}
    .company-info p{margin:3px 0;font-size:13px;color:var(--text-muted)}
    .hero-section{background:var(--brand-soft);border-radius:20px;padding:30px;margin-bottom:40px;display:flex;justify-content:space-between;align-items:center;border:1px solid #dbeafe}
    .hero-title h2{margin:0;font-size:32px;font-weight:800;color:var(--brand-dark)}
    .hero-title p{margin:4px 0 0;color:var(--text-muted);font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .client-card{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:40px;border:1px solid var(--border);border-radius:20px;padding:25px}
    .info-group label{display:block;font-size:10px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
    .info-group .val{font-size:16px;font-weight:700;color:var(--text-main)}
    table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:40px}
    th{text-align:left;padding:16px 12px;background:#f8fafc;font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border)}
    td{padding:20px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    .item-name{display:block;font-weight:700;font-size:15px;color:var(--text-main)}
    .item-tag{display:inline-block;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:800;text-transform:uppercase;margin-top:6px}
    .tag-product{background:#dcfce7;color:#166534}.tag-service{background:#f3e8ff;color:#6b21a8}
    .price-unit{color:var(--text-muted);font-size:13px;font-weight:500}
    .price-total{font-weight:800;font-size:16px;color:var(--brand)}
    .financial-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:40px}
    .notes-area{background:#f8fafc;border-radius:20px;padding:24px;border:1px solid var(--border)}
    .notes-area label{font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;display:block}
    .totals-card{background:var(--text-main);color:var(--white);border-radius:24px;padding:30px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1)}
    .total-item{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.1)}
    .total-item.grand-total{border-bottom:none;margin-bottom:0;padding-bottom:0;margin-top:20px}
    .total-item .label{font-size:14px;font-weight:600;color:rgba(255,255,255,.6)}
    .total-item .val{font-size:16px;font-weight:700}
    .total-item.grand-total .label{font-size:16px;font-weight:800;color:var(--white)}
    .total-item.grand-total .val{font-size:32px;font-weight:900;color:#4ade80}
    .footer{margin-top:60px;padding-top:40px;border-top:2px dashed var(--border);text-align:center}
    .footer-text{font-size:14px;color:var(--text-muted);font-weight:500;font-style:italic;margin-bottom:30px}
    .print-btn{position:fixed;bottom:30px;right:30px;background:var(--brand);color:white;border:none;padding:16px 32px;border-radius:50px;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 10px 15px -3px rgba(37,99,235,.4);transition:all .2s;z-index:100;display:flex;align-items:center;gap:10px}
    .print-btn:hover{background:var(--brand-dark);transform:translateY(-2px)}
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    IMPRIMIR ORÇAMENTO
  </button>
  <div class="page">
    <div class="header">
      <div style="max-width:200px">
        ${s.reportLogo ? `<img src="${s.reportLogo}" alt="Logo" style="max-width:100%;height:auto;border-radius:12px">` : `<div style="width:50px;height:50px;background:#eee;border-radius:8px"></div>`}
      </div>
      <div class="company-info">
        <h1>${s.reportCompanyName || 'ORÇAMENTO'}</h1>
        <p>${s.reportAddress || ''}</p>
        <p>📞 ${s.reportPhone || ''} | ✉️ ${s.reportEmail || ''}</p>
      </div>
    </div>
    <div class="hero-section">
      <div class="hero-title">
        <p>Documento Oficial</p>
        <h2>Orçamento de Calhas</h2>
      </div>
      <div style="text-align:right">
        <label style="display:block;font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase">Data de Emissão</label>
        <div style="font-weight:700;font-size:16px">${emissionDate}</div>
      </div>
    </div>
    <div class="client-card">
      <div class="info-group"><label>Cliente</label><div class="val">${clientName}</div></div>
      <div class="info-group"><label>Nº do Documento</label><div class="val">#${quoteNum}</div></div>
    </div>
    <table>
      <thead><tr>
        <th width="40%">Descrição do Item</th>
        <th width="20%" style="text-align:center">Quantidade</th>
        <th width="20%" style="text-align:right">Valor Unitário</th>
        <th width="20%" style="text-align:right">Valor Total</th>
      </tr></thead>
        <tbody>
          ${items.map((item: any) => item.isHeader ? `
            <tr>
              <td colspan="4" style="background:#f8fafc; font-weight:800; color:var(--brand); border-left:4px solid var(--brand); padding:8px 12px; font-size:12px;">${item.name}</td>
            </tr>
          ` : `
            <tr>
              <td>
                <span class="item-name">${item.name}</span>
                <span class="item-tag tag-${item.type}">${item.type === 'product' ? 'Produto' : 'Serviço'}</span>
              </td>
              <td style="text-align:center;font-weight:700">${item.quantity.toFixed(2)} <span class="price-unit">${item.unit || ''}</span></td>
              <td style="text-align:right"><span class="price-unit">R$ ${item.unit_price.toFixed(2)}</span></td>
              <td style="text-align:right"><span class="price-total">R$ ${item.total_price.toFixed(2)}</span></td>
            </tr>
          `).join('')}
        </tbody>
    </table>
    <div class="financial-grid">
      <div class="notes-area">
        <label>Informações Importantes</label>
        <div style="font-size:13px;color:var(--text-main);line-height:1.6;white-space:pre-wrap">${cleanNotes || 'Nenhuma observação informada.'}</div>
      </div>
      <div class="totals-card">
        <div class="total-item">
          <span class="label">Valor dos Itens</span>
          <span class="val">R$ ${totalAmount.toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `<div class="total-item" style="color:#f87171"><span class="label">Desconto</span><span class="val">− R$ ${discountAmount.toFixed(2)}</span></div>` : ''}
        <div class="total-item grand-total">
          <span class="label">TOTAL FINAL</span>
          <span class="val">R$ ${finalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">"${s.reportFooterText || 'Qualidade e compromisso com a proteção da sua estrutura.'}"</p>
      <div style="margin-top:50px;display:flex;justify-content:center;gap:40px">
        <div style="text-align:center">
          <div style="width:200px;border-bottom:1px solid var(--border);margin-bottom:8px"></div>
          <p style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Assinatura do Cliente</p>
        </div>
      </div>
      <p style="margin-top:40px;font-weight:800;color:var(--brand);font-size:14px">${s.reportCompanyName || ''}</p>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.send(html);
});

// ── Relatório A4 Compacto para Obra ──────────────────────────────────────────
// Tornado PÚBLICO para evitar problemas de sessão em novas janelas (Item 3)
app.get('/api/quotes/:id/report', async (req: any, res) => {
  const id = req.params.id;
  console.log(`[REPORT] Requesting report for estimate: ${id}`);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    console.warn(`[REPORT] Invalid UUID format: ${id}`);
    return res.status(400).send('ID inválido. Certifique-se de que o orçamento foi salvo corretamente no formato V2 (UUID).');
  }

  // 1. Buscar orçamento + itens (sem filtro de company para ser público)
  const { data: quote, error } = await supabase
    .from('estimates')
    .select('*, items:estimate_items(*)')
    .eq('id', id)
    .single();

  if (error || !quote) return res.status(404).send('Orçamento não encontrado');

  const companyId = quote.company_id;

  // 2. Buscar settings para o logo/nome
  const { data: company } = await supabase.from('companies').select('settings').eq('id', companyId).single();
  const s: any = company?.settings || {};

  // 3. Processar itens
  const bends = (quote.items || []).filter((i: any) => i.description.startsWith('[BEND] ')).map((i: any) => {
    try { return { ...JSON.parse(i.description.substring(7)), id: i.id }; } catch { return null; }
  }).filter(Boolean);

  const services = (quote.items || []).filter((i: any) => i.description.startsWith('[SERVICE] ')).map((i: any) => ({
    description: i.description.replace('[SERVICE] ', ''),
    quantity: i.quantity,
    value: i.unit_price,
    total: i.total_price
  }));

  const quoteNum = String(id).substring(0, 8).toUpperCase();
  console.log(`[REPORT] Estimate: ${quoteNum} | Grouped: ${quote.is_grouped} | Items: ${quote.items?.length}`);

  // Agrupamento por cômodo (Item 4)
  const groupedBends: Record<string, any[]> = {};
  if (quote.is_grouped) {
    bends.forEach((b: any) => {
      const g = b.group_name || 'Sem Grupo';
      if (!groupedBends[g]) groupedBends[g] = [];
      groupedBends[g].push(b);
    });
  }

  // 4. Gerar HTML Compacto
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório Obra - #${quoteNum}</title>
  <style>
    body { font-family: sans-serif; color: #333; margin: 20px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
    .logo { max-height: 50px; }
    .title { font-size: 18px; font-weight: bold; color: #2563eb; }
    .quote-info { text-align: right; }
    .section-title { background: #f8fafc; padding: 5px 10px; font-weight: bold; border-left: 4px solid #2563eb; margin: 20px 0 10px; text-transform: uppercase; font-size: 11px; }
    .group-title { background: #e2e8f0; padding: 4px 10px; font-weight: 800; margin: 15px 0 10px; border-radius: 4px; font-size: 12px; color: #1e293b; }
    .bend-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .bend-card { border: 1px solid #eee; border-radius: 8px; padding: 10px; page-break-inside: avoid; }
    .bend-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; margin-bottom: 5px; }
    .bend-details { color: #666; font-size: 10px; margin-bottom: 5px; }
    .lengths { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
    .len-tag { background: #eee; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; }
    .footer { margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 10px; color: #999; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { text-align: left; background: #f8fafc; padding: 8px; border-bottom: 1px solid #eee; font-size: 10px; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Imprimir Relatório de Obra</button>
  </div>

  <div class="header">
    <div>
      ${s.reportLogo ? `<img src="${s.reportLogo}" class="logo">` : ''}
      <div class="title">RELATÓRIO DE OBRA</div>
      <div style="font-size: 10px; color: #666;">${s.reportCompanyName || ''}</div>
    </div>
    <div class="quote-info">
      <div style="font-weight: bold; font-size: 14px;">Orçamento #${quoteNum}</div>
      <div>Data: ${new Date(quote.created_at).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="section-title">Itens de Produção (Dobras)</div>
  
  ${quote.is_grouped ?
      Object.entries(groupedBends).map(([groupName, groupBends]) => `
      <div class="group-title">🏠 ${groupName}</div>
      <div class="bend-grid">
        ${groupBends.map((b: any, idx: number) => `
          <div class="bend-card">
            <div class="bend-header">
              <span>ITEM #${idx + 1} - ${b.productName || 'Personalizado'}</span>
              <span>${b.m2?.toFixed(2)} m²</span>
            </div>
            <div class="bend-details">
              Largura: ${b.roundedWidthCm}mm | Riscos: ${(b.risks || []).length}
            </div>
            <div style="font-size: 9px; color: #888;">
              ${(b.risks || []).map((r: any) => `${r.direction === 'up' ? '↑' : r.direction === 'down' ? '↓' : '→'} ${r.sizeCm}`).join(' · ')}
            </div>
            <div class="lengths">
              ${(b.lengths || []).map((l: any) => `<span class="len-tag">${Number(l).toFixed(2)}m</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')
      : `
    <div class="bend-grid">
      ${bends.map((b: any, idx: number) => `
        <div class="bend-card">
          <div class="bend-header">
            <span>ITEM #${idx + 1} - ${b.productName || 'Personalizado'}</span>
            <span>${b.m2?.toFixed(2)} m²</span>
          </div>
          <div class="bend-details">
            Largura: ${b.roundedWidthCm}mm | Riscos: ${(b.risks || []).length}
          </div>
          <div style="font-size: 9px; color: #888;">
            ${(b.risks || []).map((r: any) => `${r.direction === 'up' ? '↑' : r.direction === 'down' ? '↓' : '→'} ${r.sizeCm}`).join(' · ')}
          </div>
          <div class="lengths">
            ${(b.lengths || []).map((l: any) => `<span class="len-tag">${Number(l).toFixed(2)}m</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `}

  ${services.length > 0 ? `
    <div class="section-title">Serviços / Mão de Obra</div>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="text-align: center;">Qtd</th>
        </tr>
      </thead>
      <tbody>
        ${services.map((s: any) => `
          <tr>
            <td>${s.description}</td>
            <td style="text-align: center; font-weight: bold;">${s.quantity}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${quote.notes ? `
    <div class="section-title">Observações</div>
    <div style="padding: 10px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; font-style: italic; white-space: pre-wrap;">${quote.notes}</div>
  ` : ''}

  <div class="footer">
    ${s.reportCompanyName || ''} - Gerado em ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.put('/api/quotes/:id/status', authenticate, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { status, cancel_reason, cancel_reason_text } = req.body;
  console.log(`[DEBUG_STATUS] Updating quote: ${id} to ${status} | User: ${req.user.id}`);

  if (status === 'draft') {
    // 1. Verificar TODAS as contas a receber deste orçamento
    const { data: listAcc } = await supabase
      .from('accounts_receivable')
      .select('id, valor_pago')
      .eq('estimate_id', id)
      .eq('company_id', req.user.companyId);

    if (listAcc && listAcc.length > 0) {
      const totalPago = listAcc.reduce((acc, curr) => acc + parseFloat(curr.valor_pago || '0'), 0);

      if (totalPago > 0) {
        return res.status(400).json({
          error: 'Existe pagamento registrado neste orçamento. Use "Criar Nova Versão" para reabrir mantendo o crédito.',
          code: 'HAS_FINANCIAL_RECORDS'
        });
      }

      // 2. Cancelar todas as contas a receber (sem pagamentos)
      const { error: delErr } = await supabase
        .from('accounts_receivable')
        .update({ status: 'canceled' })
        .eq('estimate_id', id)
        .eq('company_id', req.user.companyId)
        .in('status', ['pendente', 'parcial', 'approved']);

      if (delErr) {
        console.error('[REABRIR] Erro ao deletar CR:', delErr);
        return res.status(400).json({
          error: 'Não foi possível remover os registros financeiros vinculados. Verifique se há baixas manuais.'
        });
      }
      console.log(`[REABRIR] ✅ ${listAcc.length} CRs removidas. Orçamento ${id} reaberto.`);
    }

    // 3. Limpar ordens de produção que ainda estão pendentes
    await supabase.from('production_orders')
      .delete()
      .eq('estimate_id', id)
      .eq('company_origin_id', req.user.companyId)
      .eq('status', 'pendente');
  }

  const updateData: any = { status };
  if (status === 'cancelled' || status === 'canceled') {
    // 1. Verificar registros financeiros e de produção que impedem o cancelamento
    const { data: existingAR } = await supabase.from('accounts_receivable')
      .select('id, valor_pago')
      .eq('estimate_id', id)
      .eq('company_id', req.user.companyId)
      .not('status', 'in', '(\'cancelled\',\'canceled\')');

    const { data: existingPO } = await supabase.from('production_orders')
      .select('id, status')
      .eq('estimate_id', id)
      .eq('company_origin_id', req.user.companyId);

    // Soma valores pagos apenas nas contas ativas
    const totalPago = existingAR?.reduce((acc, curr) => acc + parseFloat(curr.valor_pago || '0'), 0) || 0;

    // Qualquer conta a receber ATIVA (mesmo sem pagamento) impede o cancelamento
    if (existingAR && existingAR.length > 0) {
      return res.status(400).json({ error: 'Não é possível cancelar um orçamento que possui contas a receber ativas ou pagamentos registrados. Reabra o orçamento ou cancele o financeiro primeiro.' });
    }

    if (totalPago > 0) {
      return res.status(400).json({ error: 'Orçamento possui pagamentos registrados e não pode ser cancelado.' });
    }

    if (existingPO && existingPO.length > 0) {
      return res.status(400).json({ error: 'Orçamento já foi enviado para a produção e não pode ser cancelado.' });
    }

    updateData.cancel_reason = cancel_reason || 'outro';
    updateData.cancel_reason_text = cancel_reason_text || '';
    updateData.canceled_at = new Date().toISOString();
  }

  if (status === 'sent') {
    updateData.data_envio = new Date().toISOString();
  }
  if (status === 'draft') {
    // Ao reativar ou reabrir, podemos limpar a data de envio se necessário
  }

  const { data, error } = await supabase.from('estimates')
    .update(updateData)
    .eq('id', id)
    .eq('company_id', req.user.companyId)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  const estimate = data;

  // ── Dispatch para empresa de dobra / Financeiro ──────────────────────────
  const isApproving = ['approved', 'accepted', 'in_production', 'paid'].includes(status);
  if (isApproving && estimate) {
    // Fire and forget — não bloqueia a resposta
    maybeCreateProductionOrder(id, req.user.companyId).catch(console.error);

    // Módulo Financeiro: Contas a Receber (Geração Automática)
    // Só cria se ainda NÃO existir para este orçamento
    const { data: existingCR } = await supabase
      .from('accounts_receivable')
      .select('id, status')
      .eq('estimate_id', id)
      .eq('company_id', req.user.companyId)
      // REGRA: só considerar CRs ativas — ignorar canceladas/convertidas
      .in('status', ['pendente', 'parcial', 'pago', 'atrasado'])
      .maybeSingle();

    if (!existingCR) {
      const valor_total = parseFloat(String(estimate.final_amount || estimate.total_amount || 0));
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      // ── Buscar crédito disponível para abater (se for nova versão de orçamento) ──
      let creditoAplicado = 0;
      let creditoId: string | null = null;

      if (estimate.parent_estimate_id) {
        // Estratégia 1: buscar crédito pelo estimate_id_origem (mais confiável — não depende de client_id)
        const { data: creditoPorOrigem } = await supabase
          .from('credits')
          .select('*')
          .eq('company_id', req.user.companyId)
          .eq('estimate_id_origem', estimate.parent_estimate_id)
          .eq('status', 'disponivel')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (creditoPorOrigem) {
          creditoAplicado = Math.min(parseFloat(String(creditoPorOrigem.valor || 0)), valor_total);
          creditoId = creditoPorOrigem.id;
          console.log(`[CREDITO] ✅ Crédito encontrado por estimate_id_origem=${estimate.parent_estimate_id}: R$${creditoAplicado}`);
        } else if (estimate.client_id) {
          // Estratégia 2: fallback por client_id (só quando não-nulo)
          const { data: creditoPorCliente } = await supabase
            .from('credits')
            .select('*')
            .eq('company_id', req.user.companyId)
            .eq('client_id', estimate.client_id)
            .eq('status', 'disponivel')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (creditoPorCliente) {
            creditoAplicado = Math.min(parseFloat(String(creditoPorCliente.valor || 0)), valor_total);
            creditoId = creditoPorCliente.id;
            console.log(`[CREDITO] ✅ Crédito encontrado por client_id=${estimate.client_id}: R$${creditoAplicado}`);
          } else {
            console.log(`[CREDITO] ℹ Nenhum crédito disponível para parent=${estimate.parent_estimate_id} ou client=${estimate.client_id}`);
          }
        } else {
          console.log(`[CREDITO] ℹ Nenhum crédito encontrado para parent=${estimate.parent_estimate_id} (client_id é null)`);
        }
      }

      const valorRestante = Math.max(0, valor_total - creditoAplicado);
      const statusCR = valorRestante < 0.01 ? 'pago' : creditoAplicado > 0 ? 'parcial' : 'pendente';

      const { data: novaCR, error: crErr } = await supabase.from('accounts_receivable').insert({
        id: crypto.randomUUID(),
        company_id: req.user.companyId,
        estimate_id: id,
        client_id: estimate.client_id || null,
        valor_total: valor_total,
        valor_pago: creditoAplicado,
        valor_restante: valorRestante,
        status: statusCR,
        data_vencimento: dueDate.toISOString().split('T')[0]
      }).select().single();

      if (crErr) {
        console.error('[FINANCEIRO] Erro ao criar conta a receber:', crErr);
      } else {
        console.log(`[FINANCEIRO] ✅ CR criada: total=R$${valor_total} | crédito=R$${creditoAplicado} | restante=R$${valorRestante} | status=${statusCR}`);

        if (creditoId && creditoAplicado > 0) {
          await supabase.from('credits').update({ status: 'utilizado' }).eq('id', creditoId);
          console.log(`[CREDITO] ✅ Crédito ${creditoId} marcado como utilizado`);
        }
      }
    } else {
      console.log(`[FINANCEIRO] CR já existe para orçamento ${id}, pulando criação`);
    }
  }


  // Reabrir simples (sem financeiro): apenas loga, o bloqueio já foi feito acima
  if (status === 'pending' && estimate) {
    console.log(`[REABRIR_SIMPLES] Orçamento ${id} reaberto para pending (sem movimentação financeira)`);
  }

  // Create payment record on 'paid'
  if (status === 'paid' && estimate) {
    await supabase.from('payments').insert({
      company_id: req.user.companyId,
      estimate_id: id,
      amount: estimate.final_amount || estimate.total_amount || 0,
      payment_method: 'pix',
      status: 'paid',
    });
  }

  res.json(estimate);
});

// =====================================================================
// NOVA VERSÃO — Cria nova cópia do orçamento com integridade financeira
// =====================================================================
app.post('/api/quotes/:id/new-version', authenticate, async (req: any, res) => {
  const originId = req.params.id;
  const companyId = req.user.companyId;

  try {
    // 1. Buscar orçamento original + itens
    const { data: origin, error: origErr } = await supabase
      .from('estimates')
      .select('*, items:estimate_items(*)')
      .eq('id', originId)
      .eq('company_id', companyId)
      .single();

    if (origErr || !origin) {
      return res.status(404).json({ error: 'Orçamento original não encontrado' });
    }

    // 2. Verificar bloqueios: só pode criar nova versão de status avançados
    const ALLOWED_STATUSES = ['approved', 'paid', 'in_production', 'finished', 'partial', 'sent'];
    if (!ALLOWED_STATUSES.includes(origin.status)) {
      return res.status(400).json({
        error: `Não é possível criar nova versão de um orçamento com status "${origin.status}". Use apenas para orçamentos aprovados ou avançados.`
      });
    }

    // 3. Buscar conta a receber e pagamentos associados
    const { data: accRec } = await supabase
      .from('accounts_receivable')
      .select('*')
      .eq('estimate_id', originId)
      .eq('company_id', companyId)
      .maybeSingle();

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('estimate_id', originId)
      .eq('company_id', companyId);

    const totalPago = (payments || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || p.valor_pago || 0), 0);
    const hasPaid = totalPago > 0;

    // 4. Calcular novo version_number
    const { data: versions } = await supabase
      .from('estimates')
      .select('version_number')
      .eq('company_id', companyId)
      .or(`id.eq.${originId},parent_estimate_id.eq.${originId}`);

    const maxVersion = (versions || []).reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 1);
    const newVersion = maxVersion + 1;

    // 5. Duplicar orçamento
    // origin_estimate_id = raiz da cadeia (se o original já tem origin, usa o mesmo; senão usa o próprio originId)
    const rootOriginId = origin.origin_estimate_id || originId;

    const { data: newEstimate, error: newEstErr } = await supabase
      .from('estimates')
      .insert({
        company_id: companyId,
        client_id: origin.client_id,
        total_amount: origin.total_amount,
        discount_amount: origin.discount_amount,
        final_amount: origin.final_amount,
        profit_amount: origin.profit_amount,
        price_per_m2: origin.price_per_m2,
        cost_per_m2: origin.cost_per_m2,
        notes: origin.notes,
        status: 'draft',
        version_number: newVersion,
        parent_estimate_id: originId,
        origin_estimate_id: rootOriginId,
        is_latest_version: true,
        is_grouped: !!origin.is_grouped // Garante persistência do agrupamento (Item 4)
      })
      .select()
      .single();

    if (newEstErr || !newEstimate) {
      console.error('[NEW_VERSION_ERROR] Failed to duplicate estimate:', newEstErr);
      return res.status(500).json({ error: 'Falha ao criar nova versão: ' + newEstErr?.message });
    }

    console.log(`[NEW_VERSION_SUCCESS] Created version ${newVersion} for ${originId} -> ${newEstimate.id} (Grouped: ${newEstimate.is_grouped})`);

    // 6. Copiar itens para nova versão
    const items = origin.items || [];
    if (items.length > 0) {
      const newItems = items.map((i: any) => ({
        estimate_id: newEstimate.id,
        product_id: i.product_id || null,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }));
      const { error: itemsErr } = await supabase.from('estimate_items').insert(newItems);

      if (itemsErr) {
        // Rollback Manual: Deleta o estimate criado
        await supabase.from('estimates').delete().eq('id', newEstimate.id).eq('company_id', companyId);
        return res.status(500).json({ error: 'Erro de integridade copiando itens. Rollback executado.' });
      }
    }

    // 7. Tratar registros financeiros do orçamento ORIGINAL
    if (hasPaid && accRec) {
      // Há pagamento: criar crédito para o cliente e marcar conta como converted_to_credit
      await supabase.from('credits').insert({
        company_id: companyId,
        client_id: origin.client_id,
        estimate_id_origem: originId,
        valor: totalPago,
        status: 'disponivel',
        observacao: `Crédito gerado ao criar nova versão do orçamento #${String(originId).substring(0, 8).toUpperCase()}`,
      });

      await supabase
        .from('accounts_receivable')
        .update({ status: 'converted_to_credit' })
        .eq('id', accRec.id)
        .eq('company_id', companyId);

      console.log(`[NOVA_VERSAO] Crédito de R$${totalPago} criado para cliente ${origin.client_id}`);
    } else if (accRec) {
      // Sem pagamento: cancelar conta a receber
      await supabase
        .from('accounts_receivable')
        .update({ status: 'canceled' })
        .eq('id', accRec.id)
        .eq('company_id', companyId);

      console.log(`[NOVA_VERSAO] Conta a receber ${accRec.id} cancelada (sem pagamento)`);
    }

    // 8. Cancelar orçamento original (marcar is_latest_version = false)
    await supabase
      .from('estimates')
      .update({ status: 'cancelled', is_latest_version: false })
      .eq('id', originId)
      .eq('company_id', companyId);

    console.log(`[NOVA_VERSAO] ✅ Nova versão ${newEstimate.id} (v${newVersion}) criada. Original ${originId} cancelado.`);

    res.json({
      success: true,
      newEstimate,
      version: newVersion,
      hasPaid,
      message: hasPaid
        ? `Nova versão criada! Um crédito de R$${totalPago.toFixed(2)} foi registrado para o cliente.`
        : 'Nova versão criada! Orçamento anterior cancelado.'
    });

  } catch (err: any) {
    console.error('[NOVA_VERSAO] Erro fatal:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao criar nova versão' });
  }
});


async function debitInventory(estimateId: number, m2Needed: number, userId: string, companyId: string) {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .gt('stock_quantity', 0)
    .order('created_at', { ascending: true });

  let remaining = m2Needed;
  for (const prod of products || []) {
    if (remaining <= 0) break;
    const debit = Math.min(remaining, prod.stock_quantity);
    await supabase.from('products').update({ stock_quantity: prod.stock_quantity - debit }).eq('id', prod.id);

    // Log consumption
    await supabase.from('activity_logs').insert({
      company_id: companyId,
      user_id: userId,
      action: 'inventory_consumption',
      entity_type: 'product',
      entity_id: prod.id,
    });
    remaining -= debit;
  }
}

// ==========================================
// MÓDULO FINANCEIRO - CONTAS A RECEBER
// ==========================================

app.get('/api/financial/receivables', authenticate, async (req: any, res) => {
  const t0 = Date.now();
  try {
    const { data, error } = await supabase
      .from('accounts_receivable')
      .select('*')
      .eq('company_id', req.user.companyId)
      // REGRA: Só mostrar CRs ativas (nunca canceladas ou convertidas em crédito)
      .in('status', ['pendente', 'parcial', 'pago', 'atrasado'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FINANCEIRO] Erro Supabase:', error);
      throw error;
    }
    const t1 = Date.now();
    console.log(`[FIN_REC_DEBUG] Supabase fetch CRs levou ${t1 - t0}ms, qtde: ${data ? data.length : 0}`);

    const accounts = data || [];
    const clientIds = [...new Set(accounts.map(a => a.client_id))].filter(Boolean);

    let clientsMap: any = {};
    if (clientIds.length > 0) {
      // Chunking if > 80 elements to prevent URL too long issues or slow queries
      const chunkSize = 80;
      for (let i = 0; i < clientIds.length; i += chunkSize) {
        const chunk = clientIds.slice(i, i + chunkSize);
        const { data: clients } = await supabase.from('clients').select('id, name, phone').in('id', chunk);
        (clients || []).forEach(c => clientsMap[c.id] = c);
      }

      const missingIds = clientIds.filter(id => !clientsMap[id]);
      if (missingIds.length > 0) {
        for (let i = 0; i < missingIds.length; i += chunkSize) {
          const chunk = missingIds.slice(i, i + chunkSize);
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', chunk);
          (profiles || []).forEach(c => Object.assign(clientsMap, { [c.id]: c }));
        }
      }
    }
    const t2 = Date.now();
    console.log(`[FIN_REC_DEBUG] Supabase map clients levou ${t2 - t1}ms`);

    const payload = accounts.map(a => ({
      ...a,
      client: clientsMap[a.client_id] || { name: 'Desconhecido' },
      estimate: { id: a.estimate_id }
    }));

    res.json(payload);
  } catch (err: any) {
    console.error('[FIN_REC_DEBUG] CATCH Error: ', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ====================================================================
// SALDO EM TEMPO REAL — Consultado ao clicar em "Registrar Pagamento"
// ====================================================================
// DUPLICATA REMOVIDA

app.post('/api/financial/receivables/:id/pay', authenticate, async (req: any, res) => {
  const { id } = req.params;
  console.log(`[FIN_PAY_DEBUG] Início do processamento para ID: ${id} | Empresa: ${req.user.companyId}`);

  try {
    const { valor_pago, data_pagamento, forma_pagamento, observacao } = req.body;
    const val = parseFloat(valor_pago);

    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ error: 'Valor de pagamento inválido' });
    }

    // 1. Localizar a Conta a Receber
    let { data: accList, error: err1 } = await supabase
      .from('accounts_receivable')
      .select('*')
      .or(`id.eq.${id},estimate_id.eq.${id}`)
      .eq('company_id', req.user.companyId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (err1) console.error('[FIN_PAY_DEBUG] Erro ao buscar conta:', err1);

    let acc = accList && accList.length > 0 ? accList[0] : null;

    if (acc && ['cancelled', 'converted_to_credit', 'canceled'].includes(acc.status)) {
      console.log(`[FIN_PAY_DEBUG] Conta encontrada estava cancelada. Ignorando para permitir pagamento via Rascunho.`);
      acc = null;
    }

    let estimate_id = acc?.estimate_id || id;

    if (!acc) {
      console.log(`[FIN_PAY_DEBUG] Conta não encontrada para ID=${id}. Buscando orçamento.`);
      const { data: estimate, error: estErr } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', id)
        .eq('company_id', req.user.companyId)
        .maybeSingle();

      if (estErr || !estimate) {
        return res.status(404).json({ error: 'Orçamento não encontrado no sistema' });
      }

      const valor_total = parseFloat(estimate.final_amount || estimate.total_amount || 0);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      // --- APLICAR CRÉDITO SE EXISTIR (Cadeia de Orçamentos/Nova Versão) ---
      let creditoAplicado = 0;
      let creditoId: string | null = null;
      if (estimate.parent_estimate_id) {
        const { data: credit } = await supabase
          .from('credits')
          .select('*')
          .eq('company_id', req.user.companyId)
          .eq('estimate_id_origem', estimate.parent_estimate_id)
          .eq('status', 'disponivel')
          .maybeSingle();

        if (credit) {
          creditoAplicado = Math.min(parseFloat(String(credit.valor || 0)), valor_total);
          creditoId = credit.id;
        }
      }

      const valorRestanteInicial = Math.max(0, valor_total - creditoAplicado);
      const statusInicial = valorRestanteInicial < 0.01 ? 'pago' : creditoAplicado > 0 ? 'parcial' : 'pendente';

      const { data: newAcc, error: createError } = await supabase.from('accounts_receivable').insert({
        id: crypto.randomUUID(),
        company_id: req.user.companyId,
        estimate_id: estimate.id,
        client_id: estimate.client_id,
        valor_total: valor_total,
        valor_pago: creditoAplicado,
        valor_restante: valorRestanteInicial,
        status: statusInicial,
        data_vencimento: dueDate.toISOString().split('T')[0]
      }).select().single();

      if (createError) throw createError;
      acc = newAcc;
      estimate_id = estimate.id;

      // Marcar crédito como utilizado
      if (creditoId && creditoAplicado > 0) {
        await supabase.from('credits').update({ status: 'utilizado' }).eq('id', creditoId);
      }
    }

    // 2. Calcular Novo Saldo
    const total_pago_acumulado = parseFloat(acc.valor_pago || 0) + val;
    const valor_total_conta = parseFloat(acc.valor_total || 0);
    const novoRestante = Math.max(0, valor_total_conta - total_pago_acumulado);
    const novoStatusConta = novoRestante < 0.01 ? 'pago' : 'parcial';

    if (val > (parseFloat(acc.valor_restante) + 0.01)) {
      return res.status(400).json({ error: `Valor excede o saldo devedor (Saldo: R$ ${acc.valor_restante})` });
    }

    // 3. Atualizar Conta e Inserir Pagamento
    await supabase.from('accounts_receivable')
      .update({
        valor_pago: total_pago_acumulado,
        valor_restante: novoRestante,
        status: novoStatusConta,
        updated_at: new Date().toISOString()
      })
      .eq('id', acc.id);

    // Build payment object using only columns that exist in the payments table
    // Existing columns: id, company_id, amount, payment_method, status, estimate_id
    // Extended columns (after running SQL migration): receivable_id, valor_pago, data_pagamento, forma_pagamento, observacao
    // NOTE: payments.status CHECK constraint only allows 'pending' | 'paid'
    const paymentBaseInsert: any = {
      id: crypto.randomUUID(),
      company_id: req.user.companyId,
      estimate_id: estimate_id,
      amount: val,
      payment_method: forma_pagamento || 'outros',
      status: 'paid',
    };

    // Try with extended columns first (if they exist after running the SQL migration)
    const paymentExtended = {
      ...paymentBaseInsert,
      receivable_id: acc.id,
      valor_pago: val,
      data_pagamento: data_pagamento || new Date().toISOString().split('T')[0],
      forma_pagamento: forma_pagamento || 'outros',
      observacao: observacao || '',
    };

    let payment: any = null;
    const { data: paymentData, error: payErr } = await supabase.from('payments').insert(paymentExtended).select().single();

    if (payErr) {
      // If error is about missing columns (PGRST204), fall back to base fields only
      if (payErr.code === 'PGRST204' || (payErr.message && payErr.message.includes('column'))) {
        console.warn('[FIN_PAY] Extended columns not yet migrated, using base insert. Error:', payErr.message);
        const { data: fallbackPayment, error: fallbackErr } = await supabase.from('payments').insert(paymentBaseInsert).select().single();
        if (fallbackErr) throw fallbackErr;
        payment = fallbackPayment;
      } else {
        throw payErr;
      }
    } else {
      payment = paymentData;
    }

    // 4. Atualizar Orçamento
    const isFullyPaid = novoRestante < 0.01;
    let newEstStatus = isFullyPaid ? 'paid' : 'approved';

    const { data: currentEst } = await supabase.from('estimates').select('status').eq('id', estimate_id).single();
    if (currentEst) {
      if (['in_production', 'ready', 'finished'].includes(currentEst.status)) {
        newEstStatus = isFullyPaid ? 'paid' : currentEst.status;
      }
    }

    await supabase.from('estimates')
      .update({ status: newEstStatus, updated_at: new Date().toISOString() })
      .eq('id', estimate_id);

    // 5. Produção
    if (newEstStatus !== 'cancelled' && newEstStatus !== 'draft') {
      maybeCreateProductionOrder(estimate_id, req.user.companyId).catch(() => { });
    }

    console.log(`[FIN_PAY_DEBUG] ✅ Sucesso! ID: ${id}`);
    res.json({ success: true, payment });

  } catch (err: any) {
    console.error('[FIN_PAY_DEBUG] Erro fatal:', err);
    res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
});

app.post('/api/quotes/:id/discount', requireMaster, async (req: any, res) => {
  const id = req.params.id; // UUID
  const { discountValue, reason } = req.body;

  const { data: quote } = await supabase.from('estimates').select('*').eq('id', id).eq('company_id', req.user.companyId).single();
  if (!quote) return res.status(404).json({ error: 'Orçamento não encontrado' });

  const finalValue = Math.max(0, (quote.total_amount || 0) - (discountValue || 0));

  await supabase.from('estimates').update({
    final_amount: finalValue
  }).eq('id', id).eq('company_id', req.user.companyId);

  res.json({ success: true, finalValue });
});

app.post('/api/quotes/:id/proof', authenticate, upload.single('proof'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum comprovante enviado' });
    const pixProofUrl = await uploadToSupabase(req.file);
    res.json({ success: true, pixProofUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// =====================
// FABRICAÇÃO (PRODUÇÃO)
// =====================
app.get('/api/fabricacao/:estimateId', authenticate, async (req: any, res) => {
  const { estimateId } = req.params;
  try {
    const { data: est, error: estErr } = await supabase
      .from('estimates')
      .select('id, status, client_id, estimate_items(*)')
      .eq('id', estimateId)
      .eq('company_id', req.user.companyId)
      .single();

    if (estErr || !est) {
      console.error('[FABRICACAO_ERROR] Orçamento não encontrado:', estErr);
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    const itemsList = est.estimate_items || [];

    let clientDispName = 'Cliente';
    if (est.client_id) {
      const { data: c } = await supabase.from('clients').select('name').eq('id', est.client_id).maybeSingle();
      if (c) clientDispName = c.name;
    }

    const { data: po, error: poErr } = await supabase
      .from('production_orders')
      .select('*')
      .eq('estimate_id', estimateId)
      .eq('company_origin_id', req.user.companyId)
      .maybeSingle();

    // Removendo bloqueio para permitir fabricacao em qualquer status nao cancelado
    // if (est.status !== 'approved' && (!po || !['accepted', 'in_production'].includes(po.status))) {
    //   return res.status(400).json({ error: 'Orçamento não está liberado para fabricação' });
    // }

    let currentPo = po;

    if (!currentPo) {
      // Auto-create Production Order if missing
      const { data: newPo, error: newPoErr } = await supabase
        .from('production_orders')
        .insert({
          company_origin_id: req.user.companyId,
          company_target_id: req.user.companyId, // CORRECAO: Era obrigatório
          estimate_id: estimateId,
          client_name: clientDispName,
          status: 'in_production'
        })
        .select()
        .single();

      if (newPoErr) return res.status(500).json({ error: 'Erro ao auto-gerar ordem de produção: ' + newPoErr.message, details: newPoErr });

      currentPo = newPo;
    }

    let { data: prodItems, error: piErr } = await supabase
      .from('production_items')
      .select('*')
      .eq('production_order_id', currentPo.id)
      .order('created_at', { ascending: true });

    if (!prodItems || prodItems.length === 0) {
      const newItems: any[] = [];

      for (const item of itemsList) {
        if ((item.description || '').startsWith('[BEND]')) {
          try {
            const bendStr = item.description.replace('[BEND]', '').trim();
            const bendData = JSON.parse(bendStr);
            const lengths = Array.isArray(bendData.lengths) ? bendData.lengths.filter((l: any) => parseFloat(l) > 0) : [];

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
                  company_id: req.user.companyId
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
                company_id: req.user.companyId
              });
            }
          } catch (e) {
            console.error('Falha ao processar BEND string', e);
          }
        }
      }

      if (newItems.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('production_items')
          .insert(newItems)
          .select();
        if (insErr) {
          fs.appendFileSync(path.join(process.cwd(), 'log_fabricacao.txt'), JSON.stringify(insErr, null, 2) + '\n');
          console.error('Insert items error:', insErr);
        } else {
          prodItems = inserted;
        }
      } else {
        prodItems = [];
      }
    }

    // Attach UI text já persistido
    const enrichedItems = prodItems || [];

    res.json({
      clientName: clientDispName,
      estimate: est,
      productionOrder: currentPo,
      items: enrichedItems
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fabricacao/item/:itemId/toggle', authenticate, async (req: any, res) => {
  const { itemId } = req.params;
  const { concluido } = req.body;
  try {
    const { data, error } = await supabase
      .from('production_items')
      .update({
        concluido,
        concluido_em: concluido ? new Date().toISOString() : null
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fabricacao/order/:orderId/finish', authenticate, async (req: any, res) => {
  const { orderId } = req.params;
  try {
    const { error } = await supabase
      .from('production_orders')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('estimate_id', orderId) // O frontend envia o estimateId como parâmetro
      .eq('company_origin_id', req.user.companyId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// INVENTORY Routes (SaaS V2 Map: /api/inventory -> products table)
// =====================
app.get('/api/inventory', requireAdmin, async (req: any, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Map fields for InventoryTab compatibility
  const mapped = (data || []).map(p => ({
    ...p,
    availableM2: p.stock_quantity || 0,
    widthM: 1.2,
    lengthM: (parseFloat(p.stock_quantity || 0) / 1.2) || 0,
    purchasedAt: p.created_at || p.createdAt || new Date().toISOString()
  }));

  res.json(mapped);
});

app.post('/api/inventory', requireAdmin, async (req: any, res) => {
  const { description, widthM, lengthM, costPerUnit, notes, lowStockThresholdM2, name, stock_quantity, price } = req.body;

  const finalName = name || description;
  if (!finalName || finalName.trim().length === 0) return res.status(400).json({ error: 'Nome/Descrição é obrigatório' });

  const finalPrice = price !== undefined && price !== '' ? parseFloat(price) : (parseFloat(costPerUnit) || 0);

  let totalM2;
  if (stock_quantity !== undefined) {
    totalM2 = parseFloat(stock_quantity);
  } else {
    const wM = parseFloat(widthM) || 1.20;
    const lM = parseFloat(lengthM) || 33;
    totalM2 = wM * lM;
  }

  const { data, error } = await supabase.from('products').insert({
    company_id: req.user.companyId,
    name: finalName,
    description: description || finalName,
    stock_quantity: totalM2,
    unit: 'm2',
    base_cost: finalPrice
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({
    ...data,
    availableM2: data.stock_quantity || 0,
    widthM: 1.2,
    lengthM: (parseFloat(data.stock_quantity || 0) / 1.2) || 0,
    purchasedAt: data.created_at || data.createdAt || new Date().toISOString()
  });
});

app.post('/api/inventory/batch', requireAdmin, async (req: any, res) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries required' });

  const inserts = entries.map((e: any) => ({
    company_id: req.user.companyId,
    name: e.name || e.description || 'Produto s/ Nome',
    description: e.description || e.name || '',
    stock_quantity: parseFloat(e.stock_quantity) || ((parseFloat(e.widthM) || 1.2) * (parseFloat(e.lengthM) || 33)),
    unit: 'm2',
    base_cost: parseFloat(e.price) || parseFloat(e.costPerUnit) || 0
  }));

  const { data, error } = await supabase.from('products').insert(inserts).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/inventory/:id', requireAdmin, async (req: any, res) => {
  await supabase.from('products').delete().eq('id', req.params.id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

app.get('/api/inventory/summary', requireAdmin, async (req: any, res) => {
  const { data: company } = await supabase.from('companies').select('settings').eq('id', req.user.companyId).single();
  const threshold = parseFloat(company?.settings?.lowStockAlertM2 || '10');

  const { data: products } = await supabase.from('products').select('stock_quantity').eq('company_id', req.user.companyId);
  const totalAvailable = (products || []).reduce((sum, p) => sum + parseFloat(p.stock_quantity || 0), 0);

  res.json({ totalAvailableM2: totalAvailable, lowStock: totalAvailable < threshold, threshold });
});


// =====================
// CLIENTS Routes
// =====================
app.get('/api/clients', requireAdmin, async (req: any, res) => {
  const { data, error } = await supabase.from('clients')
    .select('*')
    .eq('company_id', req.user.companyId)
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/clients', requireAdmin, async (req: any, res) => {
  const { name, phone, email, document, address, notes } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Telefone é obrigatório' });
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return res.status(400).json({ error: 'Telefone inválido. Informe 10 ou 11 dígitos' });

  const { data, error } = await supabase.from('clients').insert({
    company_id: req.user.companyId,
    name,
    phone,
    email: email || null,
    document: document || null,
    address: address || null,
    notes: notes || null
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/clients/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  const { name, phone, email, document, address, notes } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (!phone || !phone.trim()) return res.status(400).json({ error: 'Telefone é obrigatório' });
  const phoneDigitsPut = phone.replace(/\D/g, '');
  if (phoneDigitsPut.length < 10 || phoneDigitsPut.length > 11) return res.status(400).json({ error: 'Telefone inválido. Informe 10 ou 11 dígitos' });

  const { data, error } = await supabase.from('clients').update({
    name,
    phone,
    email: email || null,
    document: document || null,
    address: address || null,
    notes: notes || null
  }).eq('id', id).eq('company_id', req.user.companyId).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/clients/:id', requireAdmin, async (req: any, res) => {
  const { error } = await supabase.from('clients').delete()
    .eq('id', req.params.id)
    .eq('company_id', req.user.companyId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});


// =====================
// PIX KEYS Routes (dedicated table)
// =====================
app.get('/api/pix-keys', authenticate, async (req: any, res) => {
  const { data, error } = await supabase.from('pix_keys').select('*').eq('company_id', req.user.companyId).order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(k => ({
    ...k,
    pixKey: k.pix_key,
    pixCode: k.pix_code,
    qrCodeUrl: k.qr_code_url,
    sortOrder: k.sort_order
  })));
});

app.post('/api/pix-keys', requireAdmin, async (req: any, res) => {
  const { label, pixKey, keyType, bank, beneficiary, pixCode, qrCodeUrl, sortOrder } = req.body;
  const { data, error } = await supabase.from('pix_keys').insert({
    company_id: req.user.companyId,
    label,
    pix_key: pixKey,
    key_type: keyType,
    bank,
    beneficiary,
    pix_code: pixCode,
    qr_code_url: qrCodeUrl,
    sort_order: sortOrder || 0
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/pix-keys/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('pix_keys').update(req.body).eq('id', id).eq('company_id', req.user.companyId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/pix-keys/:id', requireAdmin, async (req: any, res) => {
  const id = req.params.id;
  await supabase.from('pix_keys').delete().eq('id', id).eq('company_id', req.user.companyId);
  res.json({ success: true });
});

// =====================
// DB MIGRATION Route (run-once to fix schema)
// =====================
app.post('/api/admin/migrate', requireMaster, async (req: any, res) => {
  const sqlStatements = [
    `ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb`,
    `CREATE TABLE IF NOT EXISTS public.pix_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      label text, pix_key text NOT NULL, key_type text, bank text, beneficiary text,
      pix_code text, qr_code_url text, sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      key text NOT NULL, value text, created_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.services (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      title text NOT NULL, description text, "imageUrl" text, created_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      title text NOT NULL, content text, "imageUrl" text, created_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.gallery (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
      "imageUrl" text, description text, created_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.testimonials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      author text, content text, rating integer DEFAULT 5, created_at timestamptz DEFAULT now()
    )`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean DEFAULT true`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text`,
    `ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamptz`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS estimate_id uuid`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receivable_id uuid`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2)`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS data_pagamento date`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS forma_pagamento text`,
    `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS observacao text`,
    `CREATE TABLE IF NOT EXISTS public.accounts_receivable (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
      estimate_id uuid,
      client_id uuid,
      valor_total numeric(12,2) DEFAULT 0,
      valor_pago numeric(12,2) DEFAULT 0,
      valor_restante numeric(12,2) DEFAULT 0,
      status text DEFAULT 'pendente',
      data_vencimento date,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.production_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      production_order_id uuid REFERENCES public.production_orders(id) ON DELETE CASCADE,
      estimate_item_id uuid,
      metragem numeric(12,2),
      concluido boolean DEFAULT false,
      concluido_em timestamptz,
      created_at timestamptz DEFAULT now()
    )`
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];
  for (const sql of sqlStatements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      results.push({ sql: sql.trim().substring(0, 60) + '...', ok: !error, error: error?.message });
    } catch (e: any) {
      results.push({ sql: sql.trim().substring(0, 60) + '...', ok: false, error: e.message });
    }
  }
  res.json({ results });
});


// =====================
app.post('/api/report-settings', requireAdmin, upload.single('reportLogoFile'), async (req: any, res) => {
  try {
    const {
      reportCompanyName, reportHeaderText, reportFooterText, reportPhone, reportEmail, reportAddress,
      reportPaymentTerms, reportExecDays, reportValidityDays,
      pricePerM2, costPerM2, lowStockAlertM2, defaultValidadeDays,
      whatsappAutomationEnabled, whatsappApiUrl, whatsappApiKey, whatsappMsgLembrete, whatsappMsgAnteExpiracao, whatsappMsgEnvio,
      pixKey
    } = req.body;
    const { data: company } = await supabase.from('companies').select('settings').eq('id', req.user.companyId).single();
    const settings = company?.settings || {};

    const updatedSettings: any = {
      ...settings,
      reportCompanyName, reportHeaderText, reportFooterText, reportPhone, reportEmail, reportAddress,
      reportPaymentTerms, reportExecDays, reportValidityDays,
      pricePerM2, costPerM2, lowStockAlertM2, defaultValidadeDays,
      whatsappAutomationEnabled, whatsappApiUrl, whatsappApiKey, whatsappMsgLembrete, whatsappMsgAnteExpiracao, whatsappMsgEnvio,
      pixKey
    };

    if (req.file) {
      updatedSettings.reportLogo = await uploadToSupabase(req.file);
    }

    const { error } = await supabase.from('companies').update({ settings: updatedSettings }).eq('id', req.user.companyId);
    if (error) throw error;
    res.json({ success: true, settings: updatedSettings });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// =====================
// FINANCIAL Routes (SaaS V2 Map: /api/financial -> payments table)
// =====================
app.get('/api/financial', requireAdmin, async (req: any, res) => {
  const { from, to } = req.query;
  let query = supabase.from('payments').select('*, estimate:estimates(notes)')
    .eq('company_id', req.user.companyId)
    .order('created_at', { ascending: false });

  if (from) query = query.gte('created_at', from as string);
  if (to) query = query.lte('created_at', to as string);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Map to legacy format with Fallbacks
  const mapped = (data || []).map(p => {
    let clientName = 'Cliente';
    const notes = p.estimate?.notes || '';
    if (notes.startsWith('[CLIENT: ')) {
      const match = notes.match(/\[CLIENT: (.*?)\]/);
      if (match) clientName = match[1];
    }

    return {
      id: p.id,
      quoteId: p.estimate_id,
      clientName,
      grossValue: p.amount,
      discountValue: 0,
      netValue: p.amount,
      paymentMethod: p.payment_method || p.method,
      paidAt: p.paid_at || p.created_at
    };
  });
  res.json(mapped);
});

app.get('/api/financial/summary', requireAdmin, async (req: any, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: all } = await supabase.from('payments')
    .select('amount, created_at')
    .eq('company_id', req.user.companyId);

  if (!all) return res.json({ totalAll: 0, totalToday: 0, totalMonth: 0, countAll: 0, countToday: 0, countMonth: 0, ticketAverage: 0 });

  const sum = (rows: any[]) => rows.reduce((a, r) => a + parseFloat(r.amount || 0), 0);
  const today = all.filter(r => r.created_at >= todayStart);
  const month = all.filter(r => r.created_at >= monthStart);

  res.json({
    totalAll: sum(all),
    totalToday: sum(today),
    totalMonth: sum(month),
    countAll: all.length,
    countToday: today.length,
    countMonth: month.length,
    ticketAverage: all.length > 0 ? sum(all) / all.length : 0,
  });
});


// ═══════════════════════════════════════════════════════════════════════
// PRODUCTION ORDERS — Integração Instalador ↔ Empresa de Dobra
// ═══════════════════════════════════════════════════════════════════════

// Auto-migration: cria tabela se não existir
async function ensureProductionOrdersTable() {
  try {
    const { error } = await supabase.from('production_orders').select('id').limit(1);
    if (!error) { console.log('✅ production_orders: tabela OK'); return; }

    console.log('🔧 Criando tabela production_orders...');
    console.log(`
CREATE TABLE IF NOT EXISTS production_orders (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_origin_id UUID NOT NULL,
    company_target_id UUID NOT NULL,
    estimate_id       UUID NOT NULL UNIQUE,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','in_production','ready','delivered')),
    total_metros      NUMERIC(10,4) DEFAULT 0,
    total_valor       NUMERIC(10,2) DEFAULT 0,
    notes             TEXT,
    client_name       TEXT,
    origin_name       TEXT,
    target_name       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_orders_origin  ON production_orders(company_origin_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_target  ON production_orders(company_target_id);
ALTER TABLE production_orders DISABLE ROW LEVEL SECURITY;
    `);
  } catch (e) {
    console.error('production_orders check error:', e);
  }
}

async function ensureProductionItemsTable() {
  try {
    const { error } = await supabase.from('production_items').select('id').limit(1);
    if (!error) { console.log('✅ production_items: tabela OK'); return; }

    console.log('🔧 Criando tabela production_items...');
    console.log(`
CREATE TABLE IF NOT EXISTS production_items (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estimate_id       UUID NOT NULL,
    company_id        UUID NOT NULL,
    description       TEXT,
    metragem         NUMERIC(10,4),
    comodo           TEXT DEFAULT 'Geral',
    concluido        BOOLEAN DEFAULT false,
    concluido_em     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prod_items_estimate ON production_items(estimate_id);
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
    `);
  } catch (e) {
    console.error('production_items check error:', e);
  }
}

// ── GET /api/production — lista pedidos da empresa logada (origem OU destino) ──
app.get('/api/production', authenticate, async (req: any, res) => {
  const companyId = req.user.companyId;

  const [asOrigin, asTarget] = await Promise.all([
    supabase.from('production_orders').select('*').eq('company_origin_id', companyId).order('created_at', { ascending: false }),
    supabase.from('production_orders').select('*').eq('company_target_id', companyId).order('created_at', { ascending: false }),
  ]);

  const originOrders = (asOrigin.data || []).map(o => ({ ...o, side: 'origin' }));
  const targetOrders = (asTarget.data || []).map(o => ({ ...o, side: 'target' }));

  // Merge e dedup por id
  const allMap = new Map<string, any>();
  [...targetOrders, ...originOrders].forEach(o => {
    if (!allMap.has(o.id)) allMap.set(o.id, o);
    // Se aparece dos dois lados (improvável): prioriza target
    else if (o.side === 'target') allMap.set(o.id, o);
  });

  res.json([...allMap.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
});

// ── GET /api/production/by-estimate/:id — badge de status para o instalador ──
app.get('/api/production/by-estimate/:estimateId', authenticate, async (req: any, res) => {
  const { estimateId } = req.params;
  const companyId = req.user.companyId;

  const { data, error } = await supabase
    .from('production_orders')
    .select('id, status, total_metros, total_valor, created_at')
    .eq('estimate_id', estimateId)
    .or(`company_origin_id.eq.${companyId},company_target_id.eq.${companyId}`)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

// ── PUT /api/production/:id/status — empresa de dobra avança status ──
app.put('/api/production/:id/status', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const companyId = req.user.companyId;

  const validStatuses = ['accepted', 'in_production', 'ready', 'delivered'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  // Garantir que apenas a empresa TARGET pode mudar status
  const { data: order } = await supabase.from('production_orders').select('*').eq('id', id).maybeSingle();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  if (order.company_target_id !== companyId) return res.status(403).json({ error: 'Apenas a empresa de dobra pode atualizar o status' });

  const { data, error } = await supabase
    .from('production_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/companies — lista empresas (para seletor de empresa_dobra_id) ──
app.get('/api/companies', requireAdmin, async (req: any, res) => {
  const companyId = req.user.companyId;
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, settings')
    .neq('id', companyId);  // Excluir a própria empresa

  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(c => ({
    id: c.id,
    name: (c.settings as any)?.companyName || c.name || c.id
  })));
});

// ── Hook: ao aprovar orçamento → criar production_order se empresa_dobra_id configurada ──
async function maybeCreateProductionOrder(estimateId: string, companyId: string) {
  try {
    // 1. Verificar se já existe production_order para este estimate
    const { data: existing } = await supabase
      .from('production_orders')
      .select('id')
      .eq('estimate_id', estimateId)
      .maybeSingle();
    if (existing) { console.log(`[PROD] production_order já existe para ${estimateId}`); return; }

    // 2. Buscar settings da empresa para ver se tem empresa_dobra_id
    const { data: company } = await supabase.from('companies').select('settings, name').eq('id', companyId).single();
    const settings: any = company?.settings || {};
    const dobraId: string | null = settings.empresa_dobra_id || null;
    if (!dobraId) { console.log(`[PROD] empresa_dobra_id não configurado para ${companyId}`); return; }

    // 3. Validar que empresa de dobra existe
    const { data: dobraCompany } = await supabase.from('companies').select('id, name, settings').eq('id', dobraId).single();
    if (!dobraCompany) { console.log(`[PROD] empresa_dobra não encontrada: ${dobraId}`); return; }
    const dobraName = (dobraCompany.settings as any)?.companyName || dobraCompany.name || dobraId;

    // 4. Buscar orçamento + itens para calcular metros e valor
    const { data: estimate } = await supabase
      .from('estimates')
      .select('*, items:estimate_items(*)')
      .eq('id', estimateId)
      .single();
    if (!estimate) return;

    // Extrair cliente das notes
    let clientName = '';
    let notes = estimate.notes || '';
    while (notes.startsWith('[CLIENT: ')) {
      const match = notes.match(/\[CLIENT: (.*?)\]\s?(.*)/);
      if (match) { clientName = match[1]; notes = (match[2] || '').trim(); } else break;
    }

    // Calcular total de metros das dobras
    let totalMetros = 0;
    (estimate.items || []).forEach((item: any) => {
      if (item.description?.startsWith('[BEND] ')) {
        try {
          const b = JSON.parse(item.description.substring(7));
          totalMetros += b.m2 || 0;
        } catch { }
      }
    });

    const totalValor = parseFloat(estimate.final_amount || estimate.total_amount || 0);
    const originName = settings.companyName || company?.name || companyId;

    // 5. Criar production_order
    const { data: po, error: poErr } = await supabase.from('production_orders').insert({
      company_origin_id: companyId,
      company_target_id: dobraId,
      estimate_id: estimateId,
      status: 'pending',
      total_metros: totalMetros,
      total_valor: totalValor,
      client_name: clientName,
      origin_name: originName,
      target_name: dobraName,
    }).select().single();

    if (poErr) { console.error('[PROD] Erro ao criar production_order:', poErr); return; }
    console.log(`[PROD] ✅ production_order criado: ${po.id} → ${dobraName}`);
  } catch (e) {
    console.error('[PROD] Erro inesperado:', e);
  }
}

// =====================
// Vite + Server Start
// =====================
// ... (Existing code)
app.post('/api/whatsapp/test-connection', authenticate, async (req: any, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ error: 'Acesso negado' });
  const { phone, settings } = req.body;

  const msg = "⚡ *TESTE DE CONEXÃO:* O sistema da Calhas Ferreira Sinop conseguiu se comunicar com seu robô de WhatsApp com sucesso!";

  try {
    console.log(`[WHATSAPP_TEST] Testando envio para ${phone}...`);
    const status = await performWhatsAppSend(phone, msg, settings);
    if (status) res.json({ success: true });
    else res.status(500).json({ error: 'Falha na API de WhatsApp' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Função Core de Envio para Evolution API
 */
async function performWhatsAppSend(phone: string, text: string, settings: any) {
  if (!settings.whatsappApiUrl || !settings.whatsappApiKey) {
    console.warn('[WHATSAPP] API não configurada corretamente (URL ou KEY faltando).');
    return false;
  }

  // Limpa o número (apenas dígitos)
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const response = await fetch(settings.whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': settings.whatsappApiKey
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: text,
        delay: 1200,
        linkPreview: true
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      console.log(`[WHATSAPP_SUCCESS] Mensagem enviada para ${cleanPhone}`);
      return true;
    } else {
      console.error(`[WHATSAPP_API_ERROR] Status: ${response.status}`, data);
      return false;
    }
  } catch (err) {
    console.error('[WHATSAPP_FETCH_ERROR]', err);
    return false;
  }
}

async function startServer() {
  // No Vercel, não rodamos verificações de tabela ou intervalos em cada requisição
  if (!process.env.VERCEL) {
    await ensureProductionOrdersTable();
    await ensureProductionItemsTable();

    // Iniciar rotinas de automação (Apenas em servidor real/local)
    setInterval(() => {
      runAutomationRoutines().catch(console.error);
    }, 1000 * 60 * 60); // A cada 1 hora

    runAutomationRoutines().catch(console.error); // Executar imediatamente ao iniciar
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);
    console.log('⚡ Modo Desenvolvimento: Vite Middleware carregado.');
  }
  // Solo servir estático se NÃO estiver no Vercel (ex: rodando node server.ts em VPS)
  // No Vercel, o próprio Vercel serve a pasta 'dist' nativamente.
  if (!process.env.VERCEL) { // This if condition was missing in the provided snippet, adding it back for correctness
    app.use(express.static('dist'));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }


  // Só rodar o listen manual se NÃO estiver no Vercel
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on http://localhost:${PORT}`));
  }
}

/**
 * Rotinas de Automação: 
 * 1. Expiração de orçamentos (garante que todos sejam processados, não só no fetch)
 * 2. Lembretes de WhatsApp
 */
async function runAutomationRoutines() {
  console.log('[AUTOMATION] Iniciando rotinas periódicas...');

  // 1. Expiração manual de orçamentos pendentes/enviados que passaram da data
  // (Isso complementa a verificação reativa do GET)
  const { data: toExpire } = await supabase.rpc('get_estimates_to_expire_v2');
  // Nota: Se a RPC não existir, usaremos query manual abaixo

  const { data: sentQuotes } = await supabase
    .from('estimates')
    .select('*, companies(id, settings)')
    .eq('status', 'sent');

  const today = new Date();

  for (const q of sentQuotes || []) {
    const settings = q.companies?.settings || {};
    const validade = q.validade_dias || parseInt(settings.defaultValidadeDays || '7');
    const dataEnvio = new Date(q.data_envio);
    const dataExpiracao = new Date(dataEnvio);
    dataExpiracao.setDate(dataExpiracao.getDate() + validade);

    // Verificação de Expiração
    if (today > dataExpiracao) {
      await supabase.from('estimates').update({ status: 'expired' }).eq('id', q.id);
      console.log(`[AUTOMATION] Orçamento ${q.id} marcado como expirado.`);

      // Lógica 3: Mensagem de Expirado
      await sendWhatsAppReminder(q, 'expirado', settings);
      continue;
    }

    // Lógica 1: 1 dia após envio
    const umDiaDepois = new Date(dataEnvio);
    umDiaDepois.setDate(umDiaDepois.getDate() + 1);
    if (today >= umDiaDepois) {
      await sendWhatsAppReminder(q, 'lembrete_1_dia', settings);
    }

    // Lógica 2: 1 dia antes de expirar
    const umDiaAntesDeExpirar = new Date(dataExpiracao);
    umDiaAntesDeExpirar.setDate(umDiaAntesDeExpirar.getDate() - 1);
    if (today >= umDiaAntesDeExpirar) {
      await sendWhatsAppReminder(q, 'ante_expiracao', settings);
    }
  }
}

async function sendWhatsAppReminder(estimate: any, tipo: string, settings: any) {
  // 1. Verificar se automação está ativa
  if (settings.whatsappAutomationEnabled !== 'true') return;

  // 2. Verificar se já enviamos este tipo de lembrete
  const { data: alreadySent } = await supabase
    .from('whatsapp_logs')
    .select('id')
    .eq('estimate_id', estimate.id)
    .eq('tipo_mensagem', tipo)
    .maybeSingle();

  if (alreadySent) return;

  console.log(`[WHATSAPP] Enviando lembrete ${tipo} para orçamento ${estimate.id}`);

  // 3. Montar mensagem e substituir placeholders
  let msg = '';
  const clientName = estimate.clientName || 'Cliente';
  const estimateId = estimate.id.substring(0, 8).toUpperCase();

  if (tipo === 'lembrete_1_dia') {
    msg = settings.whatsappMsgLembrete || `Olá {cliente}, seu orçamento #{id} ainda está pendente. Caso tenha dúvidas estou à disposição.`;
  } else if (tipo === 'ante_expiracao') {
    msg = settings.whatsappMsgAnteExpiracao || `Olá {cliente}, seu orçamento #{id} vence amanhã. Aproveite para garantir os valores atuais.`;
  } else if (tipo === 'expirado') {
    msg = settings.whatsappMsgExpirado || `Seu orçamento #{id} expirou. Caso ainda tenha interesse podemos atualizar os valores.`;
  }

  // Substitui placeholders
  msg = msg.replace(/{cliente}/g, clientName).replace(/{id}/g, estimateId);

  // 4. Integração Real
  try {
    const { data: client } = await supabase.from('clients').select('phone').eq('id', estimate.client_id).maybeSingle();
    const phone = client?.phone || '';
    if (!phone) {
      console.warn(`[WHATSAPP] Cliente sem telefone no orçamento ${estimate.id}`);
      return;
    }

    // Log de tentativa (Pendente)
    await supabase.from('whatsapp_logs').insert({
      company_id: estimate.company_id,
      estimate_id: estimate.id,
      tipo_mensagem: tipo,
      status: 'pendente'
    });

    const success = await performWhatsAppSend(phone, msg, settings);

    if (success) {
      await supabase.from('whatsapp_logs').update({ status: 'enviado' }).eq('estimate_id', estimate.id).eq('tipo_mensagem', tipo);
    } else {
      await supabase.from('whatsapp_logs').update({ status: 'falha' }).eq('estimate_id', estimate.id).eq('tipo_mensagem', tipo);
    }
  } catch (err) {
    console.error('[WHATSAPP_ERROR]', err);
  }
}

/**
 * Módulo de Fabricação (Checklist de Produção)
 */
app.get('/api/production-items/:estimateId', authenticate, async (req: any, res) => {
  const { estimateId } = req.params;

  // 0. Buscar dados básicos do orçamento
  const { data: estimate } = await supabase
    .from('estimates')
    .select('id, clientName')
    .eq('id', estimateId)
    .single();

  // 1. Buscar itens existentes
  const { data: existing } = await supabase
    .from('production_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('created_at', { ascending: true });

  if (existing && existing.length > 0) {
    return res.json({
      items: existing,
      clientName: estimate?.clientName || 'Cliente',
      estimateId: estimate?.id || estimateId
    });
  }

  // 2. Se não existir, inicializar com base no orçamento
  // Buscamos os bends do orçamento (armazenados em estimate_items ou na tabela de folds se existir separada)
  // No seu sistema, parece que guardamos a descrição JSONizada em estimate_items
  const { data: items } = await supabase.from('estimate_items').select('*').eq('estimate_id', estimateId);

  const toInsert: any[] = [];
  (items || []).forEach(item => {
    // Se for dobra [BEND], extraímos do JSON se possível, ou usamos a descrição
    if (item.description.includes('[BEND]')) {
      try {
        const bendContentStr = item.description.replace('[BEND] ', '');
        const bend = JSON.parse(bendContentStr);
        // Se for uma lista de medições ou item único
        if (bend.medicoes && Array.isArray(bend.medicoes)) {
          bend.medicoes.forEach((m: any) => {
            toInsert.push({
              company_id: req.user.companyId,
              estimate_id: estimateId,
              description: bend.product_id ? 'Dobra' : item.description,
              metragem: parseFloat(m.length || m.value || 0),
              comodo: bend.comodo || 'Geral',
              concluido: false
            });
          });
        } else {
          toInsert.push({
            company_id: req.user.companyId,
            estimate_id: estimateId,
            description: item.description,
            metragem: item.quantity,
            comodo: 'Geral',
            concluido: false
          });
        }
      } catch (e) {
        toInsert.push({
          company_id: req.user.companyId,
          estimate_id: estimateId,
          description: item.description,
          metragem: item.quantity,
          comodo: 'Geral',
          concluido: false
        });
      }
    }
  });

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase.from('production_items').insert(toInsert).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      items: inserted,
      clientName: estimate?.clientName || 'Cliente',
      estimateId: estimate?.id || estimateId
    });
  }

  res.json({
    items: [],
    clientName: estimate?.clientName || 'Cliente',
    estimateId: estimate?.id || estimateId
  });
});

app.put('/api/production-items/:id/toggle', authenticate, async (req: any, res) => {
  const { id } = req.params;
  const { concluido } = req.body;

  const { data, error } = await supabase
    .from('production_items')
    .update({
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/production-orders/:estimateId/finish', authenticate, async (req: any, res) => {
  const { estimateId } = req.params;

  const { error } = await supabase
    .from('production_orders')
    .update({ status: 'ready' })
    .eq('estimate_id', estimateId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/**
 * Endpoint de Cron para Vercel Automations (WhatsApp + Expiração)
 */
app.get('/api/admin/cron', async (_req, res) => {
  // O ideal é proteger isso com um header secreto no Vercel
  // if (_req.headers['x-vercel-cron-secret'] !== process.env.CRON_SECRET) return res.status(401).end();

  console.log('[CRON] Executando rotinas de automação via endpoint...');
  try {
    await runAutomationRoutines();
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware global de erro para evitar páginas HTML do Vercel
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[FATAL_ERROR]', err);
  res.status(500).json({
    error: 'Ocorreu um erro fatal no servidor.',
    details: err.message
  });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

export default app;
