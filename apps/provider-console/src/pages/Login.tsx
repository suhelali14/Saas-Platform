import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { ApiError } from '../lib/api';

/**
 * There is deliberately no sign-up. This console can provision
 * infrastructure and read every customer's commercial terms, so the only
 * way an account exists is a seed run by whoever controls the server.
 */
export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={22} className="text-emerald-400" />
          <h1 className="text-lg font-bold">Provider Console</h1>
        </div>
        <p className="text-sm text-gray-400 mb-6">Manage the clinics you have sold to.</p>

        {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm mb-4">{error}</div>}

        <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400 mb-3" />

        <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400 mb-5" />

        <Button variant="primary" type="submit" className="w-full" busyLabel="Signing in…">Sign in</Button>
      </form>
    </div>
  );
}
