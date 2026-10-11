import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Phone, X } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';

interface Reminder {
  id: string;
  diagnosis: string | null;
  chiefComplaint: string | null;
  followUpDate: string;
  patient: { id: string; uhid: string; name: string; phone: string | null };
  doctor: { id: string; name: string };
}

export function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [due, setDue] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await apiFetch<{ data: Reminder[]; due: number; upcoming: number }>('/reminders');
      setReminders(res.data);
      setDue(res.due);
      setUpcoming(res.upcoming);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load reminders.');
    }
  };

  const dismiss = async (id: string) => {
    setDismissing(id);
    try {
      await apiFetch(`/case-sheets/${id}/reminder`, { method: 'PATCH' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to dismiss.');
    } finally {
      setDismissing(null);
    }
  };

  const now = new Date();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-1"><Bell size={20} className="text-emerald-400" /> Follow-up Reminders</h1>
      <p className="text-sm text-gray-400 mb-1">Patients whose follow-up you flagged to be reminded about.</p>
      <p className="text-xs text-gray-600 mb-6">Shown here while you're using the portal -- not a phone or SMS notification.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {reminders.length > 0 && (
        <div className="flex gap-3 mb-4 text-xs">
          {due > 0 && <span className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 font-medium">{due} due now</span>}
          {upcoming > 0 && <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 font-medium">{upcoming} upcoming</span>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {reminders.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No reminders pending.</div>}
        {reminders.map((r) => {
          const isDue = new Date(r.followUpDate) <= now;
          return (
            <div key={r.id} className={`p-3.5 rounded-xl border bg-white/[0.02] flex items-center justify-between ${isDue ? 'border-red-500/30' : 'border-white/10'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/patients/${r.patient.id}`} className="font-medium text-sm hover:underline">{r.patient.name}</Link>
                  <span className="text-[10px] text-gray-500 font-mono">{r.patient.uhid}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDue ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {new Date(r.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {r.diagnosis || r.chiefComplaint || 'Follow-up'} · Dr. {r.doctor.name}
                  {r.patient.phone && <span className="ml-2 inline-flex items-center gap-1"><Phone size={10} />{r.patient.phone}</span>}
                </div>
              </div>
              <button onClick={() => dismiss(r.id)} disabled={dismissing === r.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-xs text-gray-300 hover:bg-white/20 disabled:opacity-50">
                <X size={11} /> Dismiss
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
