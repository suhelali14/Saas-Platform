import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, LogOut, UserX, UserCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/ui';
import { SkeletonList } from '../components/Skeleton';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from '../components/Toast';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Pick } from '../components/Field';

/**
 * Who works here, and what each of them may do.
 *
 * ── Two questions, deliberately separate ────────────────────────────
 *
 * The job someone does decides what they may do to patient records. Who
 * runs the clinic decides who may manage staff, settings and the audit
 * log. They were one field, and it was wrong in both directions: an
 * admin could write prescriptions, and every doctor hired received the
 * audit log -- which records who opened which patient's file.
 *
 * So the clinic head who is also a doctor is a doctor with admin rights,
 * a practice manager who is not clinical is reception with admin rights
 * and still cannot prescribe, and an employed doctor is a doctor.
 */

/** What the plan allows, as the staff list reports it. */
interface Seats {
  tier: string;
  label: string;
  used: number;
  /** null when the plan has no limit. */
  max: number | null;
  remaining: number | null;
  canAddMore: boolean;
}

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  /** How many devices this person is currently signed in on. */
  activeSessions: number;
}

const ROLES = [
  { id: 'DOCTOR', label: 'Doctor', hint: 'Writes case sheets, prescriptions and certificates.' },
  { id: 'RECEPTIONIST', label: 'Reception', hint: 'Patients, bookings, billing. Records vitals.' },
  { id: 'NURSE', label: 'Nurse', hint: 'Records vitals and lab results. No clinical writing.' },
  { id: 'PHARMACIST', label: 'Pharmacist', hint: 'Dispenses prescriptions and manages stock.' },
];

export function Staff() {
  const toast = useToast();
  const { user: me } = useClinicAuth();
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [seats, setSeats] = useState<Seats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST', isAdmin: false });

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: StaffUser[]; seats?: Seats }>('/staff');
      setStaff(res.data);
      setSeats(res.seats ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load staff.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/staff', { method: 'POST', data: form });
      setForm({ name: '', email: '', password: '', role: 'RECEPTIONIST', isAdmin: false });
      setShowNew(false);
      toast.success(`${form.name} can now sign in.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the account.');
    }
  };

  const update = async (u: StaffUser, patch: Partial<Pick2>, done: string) => {
    try {
      // Deactivating frees a seat and reactivating takes one, so the count
      // on screen has to come back from the server rather than be inferred.
      const res = await apiFetch<{ endedSessions: number }>(`/staff/${u.id}`, { method: 'PATCH', data: patch });
      // Saying so matters: an admin removing someone needs to know the
      // change reached the device they are worried about, not just the
      // database.
      const ended = res.endedSessions;
      toast.success(
        ended > 0 ? `${done} ${ended} sign-in${ended === 1 ? '' : 's'} ended.` : done,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save that change.');
    }
  };

  const signOutEverywhere = async (u: StaffUser) => {
    try {
      const res = await apiFetch<{ ended: number }>(`/staff/${u.id}/revoke-sessions`, { method: 'POST' });
      toast.success(`${u.name} signed out of ${res.ended} device${res.ended === 1 ? '' : 's'}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign them out.');
    }
  };

  return (
    <div className="max-w-[1600px] p-4 sm:p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Staff</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What someone does, and whether they help run the clinic, are separate.
          </p>
          {seats && (
            /*
             * The seat count, before the form rather than after it.
             *
             * The API refuses the create with a message naming the next tier
             * up, but that arrives once somebody has typed a name, an email
             * and a password -- too late to be useful and annoying enough to
             * read as a bug. Shown here, it is a fact about the plan.
             */
            <p className="mt-1.5 text-xs text-muted-foreground">
              {seats.max === null ? (
                <>
                  <span className="text-foreground/70">{seats.label} plan</span>
                  {' · '}{seats.used} {seats.used === 1 ? 'login' : 'logins'}, no limit
                </>
              ) : (
                <>
                  <span className="text-foreground/70">{seats.label} plan</span>
                  {' · '}
                  <span className={seats.canAddMore ? '' : 'text-ink-warning'}>
                    {seats.used} of {seats.max} {seats.max === 1 ? 'login' : 'logins'} in use
                  </span>
                  {seats.canAddMore
                    ? `, ${seats.remaining} left`
                    : ' — deactivate someone who has left, or move up a plan for more'}
                </>
              )}
            </p>
          )}
        </div>
        <Button
          icon={<Plus size={14} />}
          onClick={() => setShowNew((v) => !v)}
          // Only blocked when the form is closed: somebody who already has
          // it open should still be able to press Cancel.
          disabled={!showNew && seats ? !seats.canAddMore : false}
          title={
            !showNew && seats && !seats.canAddMore
              ? `All ${seats.max} logins on the ${seats.label} plan are in use.`
              : undefined
          }
        >
          {showNew ? 'Cancel' : 'Add someone'}
        </Button>
      </div>

      {error && (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-ink-danger">{error}</CardContent></Card>
      )}

      {showNew && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={createStaff} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Email">
                  <input required type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Password" hint="At least 10 characters. They can change it after signing in.">
                  <input required type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={INPUT} />
                </Field>
              </div>

              <Field label="What they do" hint="Decides what they may do to patient records.">
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.hint}
                      onClick={() => setForm({ ...form, role: r.id })}
                      aria-pressed={form.role === r.id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        form.role === r.id ? 'bg-primary text-primary-foreground' : 'bg-foreground/5 hover:bg-foreground/10'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </Field>

              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isAdmin}
                  onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  They also help run the clinic
                  <span className="block text-[11px] leading-relaxed text-muted-foreground">
                    Lets them manage staff, settings, the website and the audit log — which records
                    who opened which patient&rsquo;s file. Give this only to people who run the
                    practice. It does not let them write clinical records; that follows the job above.
                  </span>
                </span>
              </label>

              <Button type="submit" className="self-start">Create account</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!staff ? (
        <SkeletonList rows={3} label="Loading staff" />
      ) : (
        <ul className="flex flex-col gap-2">
          {staff.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <li key={u.id}>
                <Card variant={u.isActive ? 'panel' : 'subtle'}>
                  <CardContent size="md" className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-medium ${!u.isActive && 'text-muted-foreground line-through'}`}>{u.name}</span>
                        <span className="tone-neutral rounded-full px-2 py-0.5 text-[11px] font-medium">
                          {ROLES.find((r) => r.id === u.role)?.label ?? u.role}
                        </span>
                        {u.isAdmin && (
                          <span className="tone-violet flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                            <ShieldCheck size={10} aria-hidden /> Runs the clinic
                          </span>
                        )}
                        {isMe && <span className="text-[11px] text-muted-foreground">(you)</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {u.email}
                        {u.isActive && u.activeSessions > 0 && (
                          <span> · signed in on {u.activeSessions} device{u.activeSessions === 1 ? '' : 's'}</span>
                        )}
                        {!u.isActive && <span> · cannot sign in</span>}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.isActive && u.activeSessions > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<LogOut size={12} />}
                          onClick={() => signOutEverywhere(u)}
                        >
                          Sign out everywhere
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<ShieldCheck size={12} />}
                        onClick={() => update(u, { isAdmin: !u.isAdmin }, u.isAdmin ? `${u.name} no longer runs the clinic.` : `${u.name} can now run the clinic.`)}
                      >
                        {u.isAdmin ? 'Remove admin' : 'Make admin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={u.isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                        onClick={() => update(u, { isActive: !u.isActive }, u.isActive ? `${u.name} can no longer sign in.` : `${u.name} can sign in again.`)}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 max-w-prose text-[11px] leading-relaxed text-muted-foreground">
        Deactivating someone, or changing their job or admin rights, signs them out of every
        device immediately. It used to leave them working with full access to patient records
        until their session expired on its own.
      </p>
    </div>
  );
}

type Pick2 = { isActive: boolean; isAdmin: boolean; role: string; name: string };

const INPUT =
  'w-full rounded-lg border border-border/10 bg-foreground/5 px-3 py-2 text-sm outline-none ' +
  'transition-colors focus-visible:border-primary';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-muted-foreground/70">{hint}</span>}
    </label>
  );
}
