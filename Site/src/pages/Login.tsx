import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Hammer } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const createSupabaseClient = () => {
  // Limpar possíveis aspas ou espaços colados por engano no Vercel
  const sanitize = (val: any) => typeof val === 'string' ? val.replace(/['"]+/g, '').trim() : val;
  const url = sanitize(import.meta.env.VITE_SUPABASE_URL);
  const key = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

  if (!url || !key) {
    console.warn("[SUPABASE] Chaves de configuração ausentes no frontend.");
    return null;
  }

  try {
    return createClient(url, key);
  } catch (e) {
    console.error('[SUPABASE] Falha na inicialização do client:', e);
    return null;
  }
};

const supabase = createSupabaseClient();

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // prevents flash/loop
  const navigate = useNavigate();

  // Check if already logged in — ONE check only, with loading state
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/auth/check', { credentials: 'include' });
        const d = await res.json();
        if (cancelled) return;
        if (d.authenticated) {
          // Save to localStorage and redirect
          localStorage.setItem('user', JSON.stringify({
            authenticated: true, role: d.role, name: d.name, id: d.id,
          }));
          if (d.role === 'user') navigate('/orcamento', { replace: true });
          else navigate('/admin', { replace: true });
        } else {
          // Not authenticated — clear stale localStorage
          localStorage.removeItem('user');
          setChecking(false);
        }
      } catch {
        localStorage.removeItem('user');
        if (!cancelled) setChecking(false);
      }
    };
    check();

    if (!supabase) {
      setChecking(false);
      return;
    }
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setLoading(true);
        setChecking(true);
        try {
          const res = await fetch('/api/auth/google/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token }),
            credentials: 'include'
          });

          let data;
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await res.json();
          } else {
            const text = await res.text();
            console.error('[SYNC_DEBUG] Server returned non-JSON:', text);
            throw new Error(res.status === 500 ? 'Erro interno no servidor do Vercel' : `Erro ${res.status}: O servidor não respondeu corretamente.`);
          }

          if (res.ok) {
            localStorage.setItem('user', JSON.stringify({
              authenticated: true,
              role: data.role,
              name: data.name,
              id: data.id,
            }));
            navigate(data.role === 'user' ? '/orcamento' : '/admin', { replace: true });
          } else {
            setError(data.error || 'Erro ao sincronizar login com Google');
            setChecking(false);
            setLoading(false);
          }
        } catch (err: any) {
          setError(`Erro de login: ${err.message || 'Falha na comunicação'}`);
          setChecking(false);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify({
          authenticated: true,
          role: data.role,
          name: data.name,
          id: data.id,
        }));
        if (data.role === 'user') {
          navigate('/orcamento', { replace: true });
        } else {
          navigate('/admin', { replace: true });
        }
      } else {
        setError('Usuário ou senha inválidos');
      }
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth
  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 pt-24">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/20 rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Erro de Configuração</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            As credenciais do <b>Supabase</b> (ANON KEY) não foram detectadas.
            O login via Google e as funções de banco estão desabilitadas.
          </p>
          <button onClick={() => navigate('/')}
            className="w-full bg-slate-700 text-white py-4 rounded-2xl font-bold hover:bg-slate-600 transition-all cursor-pointer">
            Voltar para o site
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 pt-24">
      <div className="max-w-md w-full bg-slate-800 border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-2xl mb-6 shadow-lg shadow-brand-primary/30">
            <Hammer className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Central do Usuário</h1>
          <p className="text-slate-400 mt-2">Acesse para gerenciar seus orçamentos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-2xl text-sm font-medium border border-red-500/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Usuário</label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full bg-white/10 border border-white/20 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                placeholder="Seu usuário" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-white/10 border border-white/20 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                placeholder="Sua senha" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">Ou</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <button type="button" disabled={loading}
            onClick={async () => {
              setLoading(true);
              if (!supabase) {
                setError('Erro técnico: O login com Google não foi configurado corretamente (Chaves ausentes).');
                setLoading(false);
                return;
              }
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/login`,
                  queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                  },
                }
              });
              if (error) {
                setError('Erro ao iniciar login com Google');
                setLoading(false);
              }
            }}
            className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold text-lg hover:bg-slate-100 transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            Continuar com Google
          </button>
        </form>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors cursor-pointer">
            ← Voltar para o site
          </button>
        </div>
      </div>
    </div>
  );
}
