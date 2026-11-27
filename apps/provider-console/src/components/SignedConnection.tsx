import { useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/*
 * The clinic's signed connection to this console (Growth's D54, phase 2):
 * with its public key here, the clinic can subscribe to its plan from its
 * own Settings, and a plan set here (a payment, or Apply plan) is in force
 * on its server at once, with no restart. The private half stays in the
 * clinic's env (CLINIC_SIGNING_KEY); this console never holds it.
 */

interface ClinicStatus {
  ref: string | null;
  clinic: string | null;
  plan: string;
  label: string;
  modules: string[];
  readOnly: boolean;
  paidUntil: string | null;
  source: "console" | "env";
  users: number;
  maxUsers: number | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function SignedConnection({ account, onChanged }: { account: { id: string; slug: string; apiDomain: string | null; s2sPublicKey?: string | null }; onChanged: () => void }) {
  const toast = useToast();
  const [key, setKey] = useState(account.s2sPublicKey ?? "");
  const [status, setStatus] = useState<ClinicStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const connected = Boolean(account.s2sPublicKey && account.apiDomain);

  const save = async () => {
    try {
      await apiFetch(`/accounts/${account.id}/s2s-key`, { method: "PUT", data: { publicKey: key.trim() || null } });
      toast.success(key.trim() ? "Key saved." : "Key removed.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save the key.");
    }
  };
  const check = async () => {
    setChecking(true);
    try {
      setStatus(await apiFetch<ClinicStatus>(`/accounts/${account.id}/s2s-status`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The clinic did not answer.");
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-muted-foreground" /> Signed connection
          </h2>
          <Badge variant={connected ? "success" : "outline"}>{connected ? "Connected" : "Not connected"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          With this, the clinic subscribes to its plan from its own Settings, and a plan set here takes effect on its server at once. On the clinic's server set CONSOLE_URL,
          CONSOLE_PUBLIC_KEY, CLINIC_SIGNING_KEY and CONSOLE_CLINIC_REF={account.slug}; paste the clinic's public key below.
          {!account.apiDomain && " It also needs its API domain, under Addresses."}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="s2s-key">The clinic's public key</Label>
            <Input id="s2s-key" className="mt-1 font-mono text-xs" placeholder="MCowBQYDK2VwAyEA…" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <Button variant="outline" onClick={save} disabled={key.trim() === (account.s2sPublicKey ?? "")}>Save</Button>
          <Button variant="ghost" onClick={check} disabled={!connected || checking}>
            <RefreshCw /> Check the clinic now
          </Button>
        </div>
        {status && (
          <dl className="grid gap-x-6 gap-y-2 rounded-md border border-border p-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Running</dt><dd className="font-medium">{status.label}{status.readOnly ? ", paused" : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Set by</dt><dd>{status.source === "console" ? "This console" : "Its env file"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Paid until</dt><dd>{date(status.paidUntil)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Modules on</dt><dd>{status.modules.length}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Logins</dt><dd>{status.users}{status.maxUsers ? ` of ${status.maxUsers}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Its name for itself</dt><dd className="font-mono text-xs">{status.ref ?? "—"}</dd></div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
