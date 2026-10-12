import { useState } from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * There is deliberately no sign-up. This console can provision billable
 * infrastructure and read every customer's commercial terms, so the only
 * way an account exists is a seed run by whoever controls the server.
 */
export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Tracked here rather than relying on the Button's own pending state:
  // a submit button never receives onClick, because pressing Enter in a
  // text field submits the form without clicking anything.
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Deliberately no setSubmitting(false) here: a successful login
      // navigates away, and clearing it would flash the button back to
      // its idle state during the transition.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* A faint wash behind the card. Enough to stop a single form on a
          flat background looking like an error page, not enough to
          decorate a tool nobody is here to admire. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.07),transparent_60%)]"
      />

      <form onSubmit={submit} className="relative w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-5 inline-flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Provider Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the clinics you have sold to.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
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
              autoFocus
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

        <Button type="submit" className="mt-6 w-full" loading={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created on the server, never here.
        </p>
      </form>
    </div>
  );
}
