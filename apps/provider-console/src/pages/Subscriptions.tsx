import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { money } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Every subscription the console sells, for every product: what it is, what
 * it charges and how often, where it stands, and whether the product has
 * been told about the last payment. Monthly recurring revenue counts active
 * ones only, a yearly one as a twelfth.
 */

interface Sub {
  id: string;
  product: "GROWTH" | "CLINIC";
  accountRef: string;
  accountName: string;
  names: string[];
  interval: "MONTH" | "YEAR";
  amountPaise: number;
  status: string;
  currentEnd: string | null;
  cancelAtEnd: boolean;
  startsAt: string | null;
  test: boolean;
  createdBy: string;
  createdAt: string;
  lastCharge: { at: string; pushedAt: string | null; pushError: string | null } | null;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const PRODUCT = { GROWTH: "Growth", CLINIC: "Clinic" } as const;

function status(s: Sub): { label: string; variant: "success" | "warning" | "destructive" | "outline" | "primary" } {
  if (s.startsAt && new Date(s.startsAt) > new Date() && s.status !== "CANCELLED") return { label: `Starts ${date(s.startsAt)}`, variant: "primary" };
  switch (s.status) {
    case "CREATED":
      return { label: "Waiting for payment", variant: "warning" };
    case "AUTHENTICATED":
      return { label: "Set up, first charge due", variant: "primary" };
    case "ACTIVE":
      return s.cancelAtEnd ? { label: `Stops ${date(s.currentEnd)}`, variant: "outline" } : { label: `Renews ${date(s.currentEnd)}`, variant: "success" };
    case "PENDING":
      return { label: "Renewal failing", variant: "destructive" };
    case "HALTED":
      return { label: "Halted: payment failed", variant: "destructive" };
    default:
      return { label: s.status.toLowerCase(), variant: "outline" };
  }
}

export function Subscriptions() {
  const toast = useToast();
  const [data, setData] = useState<{ mode: string; monthlyRecurringPaise: number; subscriptions: Sub[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const load = () =>
    apiFetch<{ mode: string; monthlyRecurringPaise: number; subscriptions: Sub[] }>("/subscriptions")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load subscriptions."));
  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, path: string, done: string) => {
    setBusy(id + path);
    try {
      await apiFetch(`/subscriptions/${id}/${path}`, { method: "POST" });
      toast.success(done);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not do that.");
    } finally {
      setBusy("");
    }
  };
  const retry = async () => {
    const r = await apiFetch<{ pushed: number }>("/subscriptions/retry-pushes", { method: "POST" });
    toast.success(r.pushed ? `Told the products about ${r.pushed} payment${r.pushed === 1 ? "" : "s"}.` : "Nothing was waiting.");
    load();
  };

  if (error) return <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full" /></div>;
  const active = data.subscriptions.filter((s) => s.status === "ACTIVE").length;
  const unpushed = data.subscriptions.filter((s) => s.lastCharge && !s.lastCharge.pushedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(data.monthlyRecurringPaise / 100)} a month from {active} active subscription{active === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant={data.mode === "razorpay" ? "success" : data.mode === "test" ? "warning" : "outline"}>
          {data.mode === "razorpay" ? "Razorpay" : data.mode === "test" ? "Test payments: no money moves" : "Payments off"}
        </Badge>
      </div>

      {unpushed > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{unpushed} paid cycle{unpushed === 1 ? " has" : "s have"} not reached the product yet. The console tries again every minute.</span>
          <Button size="sm" variant="outline" onClick={retry}><RefreshCw /> Try now</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {data.subscriptions.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">None yet. Owners subscribe from their product's Plans page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium">Plan</th>
                    <th className="px-3 py-2.5 text-right font-medium">Charges</th>
                    <th className="px-3 py-2.5 font-medium">Where it stands</th>
                    <th className="px-3 py-2.5 font-medium">Product told</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.subscriptions.map((s) => {
                    const st = status(s);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3">
                          <span className="block font-medium">{s.accountName}</span>
                          <span className="text-xs text-muted-foreground">{PRODUCT[s.product]} · started by {s.createdBy} · {date(s.createdAt)}</span>
                        </td>
                        <td className="px-3 py-3">
                          {s.names.join(" + ")}
                          {s.test && <Badge variant="warning" className="ml-2">test</Badge>}
                        </td>
                        <td className="px-3 py-3 text-right tabular">
                          {money(s.amountPaise / 100)}
                          <span className="block text-[11px] text-muted-foreground">{s.interval === "MONTH" ? "a month" : "a year"}</span>
                        </td>
                        <td className="px-3 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="px-3 py-3 text-xs">
                          {!s.lastCharge ? (
                            <span className="text-muted-foreground">No payment yet</span>
                          ) : s.lastCharge.pushedAt ? (
                            <span className="text-success">Yes, {date(s.lastCharge.pushedAt)}</span>
                          ) : (
                            <span className="text-destructive" title={s.lastCharge.pushError ?? ""}>Not yet{s.lastCharge.pushError ? `: ${s.lastCharge.pushError}` : ""}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {s.test && s.status === "ACTIVE" && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => act(s.id, "test-renew", "Renewed, as if the month had passed.")}>Renew now</Button>
                                <Button size="sm" variant="outline" disabled={busy !== ""} onClick={() => act(s.id, "test-fail", "The renewal failed, as with a bounced mandate.")}>Fail renewal</Button>
                              </>
                            )}
                            {["ACTIVE", "AUTHENTICATED", "PENDING", "CREATED"].includes(s.status) && !s.cancelAtEnd && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy !== ""}
                                onClick={() => {
                                  if (window.confirm(`Stop renewing ${s.accountName}'s ${s.names.join(" + ")}? What is paid stays open until ${date(s.currentEnd)}.`)) {
                                    act(s.id, "cancel", "It stops at the end of what is paid.");
                                  }
                                }}
                              >
                                Stop renewing
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
