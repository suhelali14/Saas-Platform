import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, AlertCircle } from 'lucide-react';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { apiFetch } from '../lib/api';
import { Button } from '../components/Button';
import { Card, CardContent, Input, Label } from '../components/ui';

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
                className="mb-4 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
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
