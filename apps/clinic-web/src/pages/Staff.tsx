import { useState, useEffect } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '../components/Button';
import { apiFetch, ApiError } from '../lib/api';

interface StaffUser {
  id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string;
}

const ROLES = ['DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST', 'ADMIN'];

export function Staff() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await apiFetch<{ data: StaffUser[] }>('/staff');
      setStaff(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load staff.');
    }
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch('/staff', { method: 'POST', data: form });
      setForm({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
      setShowNew(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add staff member.');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (member: StaffUser) => {
    try {
      await apiFetch(`/staff/${member.id}`, { method: 'PATCH', data: { isActive: !member.isActive } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update.');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Staff</h1>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
          <Plus size={14} /> Add Staff
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Staff accounts for this clinic.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {showNew && (
        <form onSubmit={createStaff} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
          <input type="password" placeholder="Temporary password (min 6 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={creating} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {creating ? 'Adding...' : 'Add Staff Member'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {staff.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <div>
              <div className="font-medium text-sm">{m.name} <span className="text-xs text-muted-foreground/70">· {m.role}</span></div>
              <div className="text-xs text-muted-foreground/70">{m.email}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggleActive(m)} title={m.isActive ? 'Deactivate' : 'Activate'}>
              {m.isActive ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} className="text-muted-foreground/70" />}
              {m.isActive ? 'Active' : 'Inactive'}
            </Button>
          </div>
        ))}
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground/60 py-8 text-center">
            No staff accounts yet. Add one above to let reception or a nurse sign in.
          </p>
        )}
      </div>
    </div>
  );
}
