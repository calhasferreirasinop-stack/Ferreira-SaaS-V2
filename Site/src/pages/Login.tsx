import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Hammer } from 'lucide-react';

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
    return () => { cancelled = true; };
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
