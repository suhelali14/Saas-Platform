import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ExternalLink, RotateCcw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { PlanTier } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Demo {
  plan: PlanTier;
  label: string;
  account: { id: string; slug: string; name: string; status: string; provisionedAt: string | null } | null;
  portalUrl: string | null;
  siteUrl: string | null;
  logins: { email: string; who: string }[];
}

interface DemosResponse { password: string; demos: Demo[]; canReset: boolean }

/**
 * A demo for each plan, ready to show.
 *
 * Every demo is a real deployment of the same code a customer gets, with
 * made-up patients that reset every morning. "Reset now" refreshes one
 * right before a meeting, so the waiting times on the queue are true when
 * the prospect looks. The logins are shown in the clear because there is
 * nothing behind them but invented patients.
 */
export function Demos() {
  const toast = useToast();
  const [data, setData] = useState<DemosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<DemosResponse>("/demos"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the demos.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked; the text is on screen anyway */
    }
  };

  if (error) return <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-64 w-full" /></div>;

  const missing = data.demos.filter((d) => !d.account).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Demos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One clinic per plan, with made-up patients, reset every morning at 7:30. Password for every login: <span className="font-mono text-foreground">{data.password}</span>
          </p>
        </div>
        {missing > 0 && (
          <Button onClick={async () => {
            try {
              // The API also returns `provisioned` when inline
              // provisioning is on, so the operator is told exactly
              // what happened instead of a vague "created; provision
              // each from its page" that left them wondering why
              // clicking Demos had not produced a live demo.
              const r = await apiFetch<{ created: string[]; provisioned: string[] }>("/demos", { method: "POST", data: {} });
              if (!r.created.length) {
                toast.success("Nothing to create.");
              } else if (r.provisioned.length === r.created.length) {
                toast.success(`${r.created.join(", ")} created and live.`);
              } else if (r.provisioned.length > 0) {
                toast.success(`${r.provisioned.join(", ")} created and live. ${r.created.filter((s) => !r.provisioned.includes(s)).join(", ")} need provisioning from each account page.`);
              } else {
                toast.success(`${r.created.join(", ")} created. Provision each from its page.`);
              }
              await load();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Could not create the demos.");
            }
          }}>
            Create the missing {missing === 1 ? "demo" : `${missing} demos`}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.demos.map((d) => (
          <Card key={d.plan}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[22px] font-semibold uppercase leading-none tracking-[0.02em]">{d.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{d.account ? d.account.name : "No demo yet"}</p>
                </div>
                {d.account && (
                  <Badge variant={d.account.status === "LIVE" ? "success" : "outline"}>
                    {d.account.provisionedAt || d.account.status === "LIVE" ? "running" : "not provisioned"}
                  </Badge>
                )}
              </div>

              {d.account && (d.account.provisionedAt || d.account.status === "LIVE") ? (
                <>
                  <div className="space-y-1.5 text-sm">
                    <a href={d.portalUrl ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium hover:underline">
                      Staff portal <ExternalLink className="size-3.5" />
                      <span className="font-mono text-xs font-normal text-muted-foreground">{d.portalUrl?.replace("https://", "")}</span>
                    </a>
                    <a href={d.siteUrl ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium hover:underline">
                      Clinic website <ExternalLink className="size-3.5" />
                      <span className="font-mono text-xs font-normal text-muted-foreground">{d.siteUrl?.replace("https://", "")}</span>
                    </a>
                  </div>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {d.logins.map((l) => (
                      <li key={l.email} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs">{l.email}</p>
                          <p className="text-[11px] text-muted-foreground">{l.who}</p>
                        </div>
                        <button type="button" onClick={() => copy(l.email)} aria-label={`Copy ${l.email}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                          {copied === l.email ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!data.canReset}
                      onClick={async () => {
                        try {
                          await apiFetch(`/accounts/${d.account!.id}/reset-demo`, { method: "POST", data: {} });
                          toast.success("Resetting. Give it a minute.");
                        } catch (e) {
                          toast.error(e instanceof ApiError ? e.message : "Could not reset.");
                        }
                      }}
                    >
                      <RotateCcw className="size-3.5" /> Reset now
                    </Button>
                    <Link to={`/clinics/${d.account.id}`} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Open its page</Link>
                    {!data.canReset && <span className="text-[11px] text-muted-foreground">The job runner is not reachable from here.</span>}
                  </div>
                </>
              ) : d.account ? (
                <p className="text-sm text-muted-foreground">
                  Created, not running yet. <Link to={`/clinics/${d.account.id}`} className="font-medium text-foreground underline underline-offset-4">Provision it</Link> like any clinic; it fills itself with made-up patients.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Use “Create the missing demos” above.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
