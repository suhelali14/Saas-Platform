import { useState } from 'react';
import { Clock, ArrowLeft } from 'lucide-react';
import { getApiBaseUrl } from '../lib/api';
import { palette, publicAsset } from '../lib/public-site';
import { usePolling } from '../lib/usePolling';

// Public, no login -- the "innovative" feature from the plan's research:
// real token/queue-transparency displays measurably cut perceived wait time
// and front-desk interruptions just by letting people see their position.
// Deliberately shows only position/status/doctor and a privacy-safe
// last-4-of-UHID label -- never a name or phone number, since this page has
// no authentication at all.
//
// ── Part of the clinic's website, not a separate screen ──────────────
//
// This used to be painted in the STAFF PORTAL's tokens -- bg-background,
// border-border/10, an emerald accent. A patient who followed "Check the
// live queue" from the clinic's own site arrived somewhere that plainly
// belonged to a different product, and once the portal's palette changed
// this page silently changed with it, for people who never see the
// portal.
//
// It is a patient-facing page, so it is dressed like the rest of the
// clinic's public site: the same light ground, the clinic's own chosen
// colour, its logo, and a way back to the site it came from. The palette
// arrives with the queue payload rather than from a second request,
// because this page polls.

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
  const [theme, setTheme] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  usePolling(async () => {
    try {
      const res = await fetch(`${publicQueueBase()}/queue`);
      const data = await res.json();
      setClinicName(data.clinicName);
      setTheme(data.theme ?? null);
      setLogoPath(data.logoPath ?? null);
      setQueue(data.queue);
      setUpdatedAt(data.updatedAt);
    } catch {
      // silent -- a failed refresh just keeps showing the last known state
    }
  }, REFRESH_MS);

  const p = palette(theme);
  const nowServing = queue.find((q) => q.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* The same header shape as the rest of the site, so arriving here
          from it does not feel like leaving it. */}
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoPath ? (
              <img src={publicAsset(logoPath)} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
            ) : (
              <span className={`h-8 w-8 rounded-lg ${p.soft} ${p.ring} grid place-items-center text-sm font-bold shrink-0`}>
                {clinicName.charAt(0)}
              </span>
            )}
            <span className="font-semibold truncate">{clinicName}</span>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 shrink-0"
          >
            <ArrowLeft size={14} aria-hidden /> Back to the website
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-10 md:py-14">
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today at the clinic</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Who is being seen now, and who is waiting. No names are shown.
          </p>
        </div>

        {nowServing ? (
          <div className={`mb-10 rounded-2xl ${p.soft} px-6 py-8 text-center`}>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Now serving</div>
            <div className={`mt-2 text-6xl md:text-7xl font-black tabular-nums ${p.ring}`}>
              {nowServing.patientLabel}
            </div>
            {nowServing.doctorName && (
              <div className="mt-2 text-slate-600">with Dr. {nowServing.doctorName}</div>
            )}
          </div>
        ) : (
          queue.length > 0 && (
            <div className="mb-10 rounded-2xl bg-slate-50 px-6 py-6 text-center text-slate-600">
              Nobody is in with the doctor at the moment.
            </div>
          )
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-4">
          <Clock size={11} aria-hidden /> Updates every {REFRESH_MS / 1000} seconds
          {updatedAt && <span>· last checked {new Date(updatedAt).toLocaleTimeString()}</span>}
        </div>

        {queue.length === 0 ? (
          /* An empty queue is good news for whoever is reading this, so it
             says so rather than reporting an absence of data. */
          <div className="rounded-2xl border border-slate-200 px-6 py-12 text-center">
            <p className="font-medium">There is no queue right now.</p>
            <p className="mt-1 text-sm text-slate-600">
              Come in and you will be seen shortly.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {queue.map((entry) => {
              const serving = entry.status === 'IN_PROGRESS';
              return (
                <li
                  key={entry.position}
                  className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3 rounded-xl border ${
                    serving ? `${p.soft} border-transparent` : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xl font-bold tabular-nums text-slate-400 w-7 shrink-0">
                      {entry.position}
                    </span>
                    <span className="text-base font-mono truncate">{entry.patientLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {entry.doctorName && (
                      <span className="hidden sm:inline text-sm text-slate-600">Dr. {entry.doctorName}</span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        serving ? `${p.solid} text-white` : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Patients are shown by file number, never by name.
        </p>
      </main>
    </div>
  );
}
