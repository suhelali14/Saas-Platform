import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, AlertCircle } from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { apiFetch } from '../lib/api';
import { Button } from '../components/Button';
// Direct paths, not the barrel: this is the only page that is eagerly
// imported, so anything it reaches lands in the startup chunk.
import { Card, CardContent } from '../components/ui/card';
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm">
        {/* A form, not a div with a button: pressing Enter in the password
            field has to submit, which is how most people sign in. */}
        <form onSubmit={handleSubmit} noValidate={false}>
          <CardContent className="p-7">
            <div className="mb-1 flex items-center gap-2">
              <Stethoscope size={20} className="text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold tracking-tight">{clinicName || 'Clinic Portal'}</h1>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">Sign in with your staff credentials.</p>

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
              Sign In
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
