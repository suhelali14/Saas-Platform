import { useEffect, useState } from 'react';
import { Copy, MessageCircle, ShieldCheck } from 'lucide-react';
import { apiFetch, ApiError, getApiBaseUrl } from '../lib/api';
import { useToast } from './Toast';
import { Button } from './Button';

/**
 * Connections: the token the clinic gives its Nayaverse Growth WhatsApp
 * assistant. Admins only, as the API requires. The token is shown once:
 * only its hash is kept, so a lost token is revoked and a new one made.
 */

interface Token {
  id: string;
  name: string;
  tokenTail: string;
  connected: boolean;
  createdByName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedByName: string | null;
}

/** The address Growth calls: this clinic's API host. */
function connectorAddress(): string {
  try {
    return new URL(getApiBaseUrl()).origin;
  } catch {
    return window.location.origin;
  }
}

export function ConnectorSettings() {
  const toast = useToast();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState('WhatsApp assistant');
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    apiFetch<{ tokens: Token[] }>('/connector/tokens').then(
      (r) => setTokens(r.tokens),
      (e) => toast.error(e instanceof ApiError ? e.message : 'Could not load the connections.'),
    );
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ token: string }>('/connector/tokens', { method: 'POST', data: { name } });
      setFresh(r.token);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not create the token.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (t: Token) => {
    if (!window.confirm(`Revoke “${t.name}”? The WhatsApp assistant using it stops seeing your timings and sending requests at once.`)) return;
    try {
      await apiFetch(`/connector/tokens/${t.id}/revoke`, { method: 'POST' });
      await load();
      toast.success('Revoked.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not revoke it.');
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Copied.'), () => undefined);
  const active = (tokens ?? []).filter((t) => !t.revokedAt);
  const address = connectorAddress();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border/10 bg-foreground/[0.02] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle size={15} className="text-muted-foreground" /> Nayaverse Growth: your WhatsApp assistant
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          With a token, your WhatsApp assistant shows patients your doctors, timings, fees and free times, sends their booking to your Requests list for reception to confirm,
          and tells a patient their own next appointment and queue number.
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground/80">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          It can never see records, prescriptions, test results or anyone else's appointments. Nothing is booked until reception confirms it.
        </p>

        {fresh ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold">Copy this token now. It is not shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">{fresh}</code>
              <Button size="sm" variant="outline" onClick={() => copy(fresh)}>
                <Copy size={13} /> Copy
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">In Nayaverse Growth, open WhatsApp assistant, choose the Clinic kit, and paste:</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Clinic address</span>
              <code className="rounded bg-background px-2 py-1">{address}</code>
              <button type="button" className="text-primary hover:underline" onClick={() => copy(address)}>
                Copy
              </button>
            </div>
            <Button size="sm" className="mt-3" onClick={() => setFresh(null)}>
              I have copied it
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full rounded-lg border border-border/10 bg-foreground/5 px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <Button variant="primary" onClick={create} disabled={busy || name.trim().length < 2}>
              Create a token
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/10 bg-foreground/[0.02] p-4">
        <h2 className="text-sm font-semibold">Tokens</h2>
        {tokens === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/10">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t.name} <span className="text-muted-foreground">····{t.tokenTail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.revokedAt
                      ? `Revoked ${new Date(t.revokedAt).toLocaleDateString()}${t.revokedByName ? ` by ${t.revokedByName}` : ''}`
                      : `${t.connected ? 'Connected' : 'Not connected yet'} · made ${new Date(t.createdAt).toLocaleDateString()}${t.createdByName ? ` by ${t.createdByName}` : ''}${t.lastUsedAt ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}` : ''}`}
                  </p>
                </div>
                {!t.revokedAt && (
                  <Button size="sm" variant="outline" onClick={() => revoke(t)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {active.length > 0 && <p className="mt-2 text-xs text-muted-foreground/70">Revoke a token you no longer use, or one you think someone else has seen.</p>}
      </div>
    </div>
  );
}
