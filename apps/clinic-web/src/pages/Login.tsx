import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { apiFetch } from '../lib/api';
import { Button } from '../components/Button';
// Direct paths, not the barrel: this is the only page that is eagerly
// imported, so anything it reaches lands in the startup chunk.
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

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

  /*
   * Why they were sent here, if the API said.
   *
   * Arriving at a login screen you did not ask for, mid-task, with no
   * explanation is the moment a receptionist decides the software is
   * broken. The usual reason is that this account signed in on another
   * device, and saying so turns a fault into a fact.
   *
   * Read once and cleared, so it does not reappear on a later deliberate
   * sign-out.
   */
  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('clinicSignedOutReason');
      if (reason) {
        setError(reason);
        sessionStorage.removeItem('clinicSignedOutReason');
      }
    } catch {
      // Private mode. Nothing to show, nothing to clear.
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/queue', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const name = clinicName || 'Clinic portal';

  return (
    <div className="portal grid min-h-dvh bg-background text-foreground lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* The clinic's side: its own name, and what this screen is for. No
          feature list and no figures: the people signing in already work
          here. */}
      <div className="hidden bg-[hsl(45_8%_10%)] text-[hsl(42_36%_95%)] lg:block">
        <div className="flex h-full flex-col justify-between gap-10 p-12 xl:p-16">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[hsl(42_36%_95%/0.6)]">Nayaverse Clinic</p>
          <div>
            <p className="max-w-[14ch] font-display text-[3rem] font-semibold uppercase leading-[0.98] tracking-[0.01em]">{name}</p>
            <p className="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-[hsl(42_36%_95%/0.72)]">
              Today's queue, every patient's visits day by day, prescriptions, bills and the pharmacy, in one place.
            </p>
          </div>
          <p className="max-w-[52ch] text-[13px] text-[hsl(42_36%_95%/0.55)]">
            Patient records are private. Every time a record is opened, the clinic's audit log notes who opened it and when.
          </p>
        </div>
      </div>

      <div className="flex flex-col px-4 pb-10 pt-[max(32px,env(safe-area-inset-top))] sm:px-10 lg:justify-center lg:pt-10">
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nayaverse Clinic</p>
            <p className="mt-1.5 font-display text-[1.8rem] font-semibold uppercase leading-none tracking-[0.01em]">{name}</p>
          </div>

          {/* A form, not a div with a button: pressing Enter in the password
              field has to submit, which is how most people sign in. */}
          <form onSubmit={handleSubmit} noValidate={false}>
            <h1 className="font-display text-[1.9rem] font-semibold uppercase leading-none tracking-[0.01em]">Sign in</h1>
            <p className="mb-6 mt-2 text-[15px] text-muted-foreground">Use the email and password your clinic gave you.</p>

            {error && (
              <div
                className="mb-4 flex items-start gap-2 rounded-md border border-ink-danger/25 bg-ink-danger/10 p-3 text-sm text-ink-danger"
                // Assertive: a failed sign-in has to interrupt, because
                // nothing else on this screen will have changed and a
                // screen-reader user would otherwise be left waiting.
                role="alert"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              busy={loading}
              busyLabel="Signing in…"
              className="mt-6 w-full"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
