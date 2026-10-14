import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { PATIENT_CATEGORIES, CATEGORY_BADGES } from '../lib/categories';
import { Pick } from '../components/Field';

interface Patient {
  id: string;
  uhid: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  bloodGroup: string | null;
  category: string;
}


/** The options a patient's gender field offers. One list, shared by the
 *  create and the edit form -- they were two literal copies, which is how
 *  one screen ends up offering a choice the other does not. */
const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({ name: '', age: '', gender: '', phone: '', bloodGroup: '', allergies: '', chronicConditions: '', category: 'GENERAL' });

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch<{ data: Patient[] }>(`/patients${qs}`);
      setPatients(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load patients.');
    }
  };

  const createPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch('/patients', {
        method: 'POST',
        data: {
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          bloodGroup: form.bloodGroup || undefined,
          allergies: form.allergies || undefined,
          chronicConditions: form.chronicConditions || undefined,
          category: form.category,
        },
      });
      setForm({ name: '', age: '', gender: '', phone: '', bloodGroup: '', allergies: '', chronicConditions: '', category: 'GENERAL' });
      setShowNew(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add patient.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Patients</h1>
        <button onClick={() => setShowNew((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
          <Plus size={14} /> New Patient
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Patient records and history.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {showNew && (
        <form onSubmit={createPatient} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <input placeholder="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <Pick
            value={form.gender}
            onChange={(gender) => setForm({ ...form, gender })}
            emptyLabel="Not recorded"
            placeholder="Gender"
            options={GENDERS}
          />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <input placeholder="Blood group" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">OPD Priority Category</label>
            <Pick
              value={form.category}
              onChange={(category) => setForm({ ...form, category })}
              options={PATIENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            />
          </div>
          <input placeholder="Known allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <input placeholder="Chronic conditions" value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          <button type="submit" disabled={creating} className="col-span-2 self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {creating ? 'Adding...' : 'Add Patient'}
          </button>
        </form>
      )}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, UHID (file no.), or phone..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        {patients.length === 0 && <div className="text-center py-10 text-muted-foreground/70 text-sm">No patients found.</div>}
        {patients.map((p) => (
          <Link key={p.id} to={`/patients/${p.id}`} className="flex items-center justify-between p-3.5 rounded-xl border border-border/10 bg-foreground/[0.02] hover:bg-foreground/[0.05]">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-medium text-sm">{p.name}</div>
                <span className="text-[10px] text-emerald-400 font-mono">{p.uhid}</span>
                {CATEGORY_BADGES[p.category] && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_BADGES[p.category].color}`}>
                    {CATEGORY_BADGES[p.category].label}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground/70 flex items-center gap-2">
                {p.age != null && <span>{p.age}y</span>}
                {p.gender && <span>{p.gender}</span>}
                {p.bloodGroup && <span>{p.bloodGroup}</span>}
                {p.phone && <span className="flex items-center gap-1"><Phone size={10} />{p.phone}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
