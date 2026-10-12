import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { apiFetch } from '../lib/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const { login } = useClinicAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ name: string }>('/public-info').then((info) => setClinicName(info.name)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/queue', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 rounded-2xl border border-border/10 bg-foreground/[0.03]">
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={20} className="text-emerald-400" />
          <h1 className="text-xl font-bold">{clinicName || 'Clinic Portal'}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Sign in with your staff credentials.</p>

        {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

        <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400"
        />

        <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-6 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
