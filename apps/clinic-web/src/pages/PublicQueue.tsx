import { useState, useEffect } from 'react';
import { Stethoscope, Clock } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';

// Public, no login -- the "innovative" feature from the plan's research:
// real token/queue-transparency displays measurably cut perceived wait time
// and front-desk interruptions just by letting people see their position.
// Deliberately shows only position/status/doctor and a privacy-safe
// last-4-of-UHID label -- never a name or phone number, since this page has
// no authentication at all.

/** Resolved per request, not once at import: this page is served on
 *  every clinic's hostname from one bundle, and which clinic it is is
 *  not known until the tenant directory has answered. */
const publicQueueBase = () => getApiBaseUrl().replace(/\/clinic$/, '/clinic/public');
const REFRESH_MS = 20_000;

interface QueueEntry { position: number; status: string; doctorName: string | null; patientLabel: string }

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Waiting',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'Now Serving',
};

export function PublicQueue() {
  const [clinicName, setClinicName] = useState('Clinic');
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${publicQueueBase()}/queue`);
        const data = await res.json();
        setClinicName(data.clinicName);
        setQueue(data.queue);
        setUpdatedAt(data.updatedAt);
      } catch {
        // silent -- a failed refresh just keeps showing the last known state
      }
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const nowServing = queue.find((q) => q.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center">
      <div className="flex items-center gap-2 mb-8">
        <Stethoscope size={28} className="text-emerald-400" />
        <h1 className="text-2xl font-bold">{clinicName}</h1>
      </div>

      {nowServing && (
        <div className="mb-10 text-center">
          <div className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Now Serving</div>
          <div className="text-7xl font-black text-emerald-400">{nowServing.patientLabel}</div>
          {nowServing.doctorName && <div className="text-lg text-muted-foreground mt-2">Dr. {nowServing.doctorName}</div>}
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-3 justify-center">
          <Clock size={11} /> Updates every {REFRESH_MS / 1000}s
          {updatedAt && <span>· Last: {new Date(updatedAt).toLocaleTimeString()}</span>}
        </div>
        <div className="flex flex-col gap-2">
          {queue.length === 0 && <div className="text-center text-muted-foreground/70 py-10">No one in the queue right now.</div>}
          {queue.map((entry) => (
            <div
              key={entry.position}
              className={`flex items-center justify-between px-5 py-3 rounded-xl border ${
                entry.status === 'IN_PROGRESS' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/10 bg-foreground/[0.02]'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-muted-foreground/70 w-8">{entry.position}</span>
                <span className="text-lg font-mono">{entry.patientLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                {entry.doctorName && <span className="text-sm text-muted-foreground">Dr. {entry.doctorName}</span>}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${entry.status === 'IN_PROGRESS' ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground/80'}`}>
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
