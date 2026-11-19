import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, FileText, History, Wallet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  type AccountDetail as Detail, type Invoice, type Meta, type PlanChange, type PlanTier, type PricingModel,
  PLAN_LABEL, PRICING_LABEL, money,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Account = Detail["account"];

function Panel({ title, icon: Icon, action, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4 text-muted-foreground" />
            {title}
          </h2>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const num = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

/**
 * Plan and modules, and whether the clinic has been told.
 *
 * The plan sets the default modules; each module can be added to or
 * taken off this one deal. Saving changes the console only. "Apply to
 * clinic" is the step that changes what the clinic can do, and the panel
 * says plainly when what the clinic runs differs from what is chosen.
 */
export function PlanModulesPanel({ account, meta, features, pendingApply, wouldRemove, onSaved }: {
  account: Account; meta: Meta | null; features: string[]; pendingApply: boolean; wouldRemove: string[]; onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState<PlanTier>(account.plan);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(account.featureOverrides ?? {});
  const [seats, setSeats] = useState(account.maxUsersOverride === null ? "" : String(account.maxUsersOverride));
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ envLines: string; queued: boolean; jobId: string | null } | null>(null);
  const [job, setJob] = useState<{ state: string; message: string } | null>(null);

  useEffect(() => {
    setPlan(account.plan);
    setOverrides(account.featureOverrides ?? {});
    setSeats(account.maxUsersOverride === null ? "" : String(account.maxUsersOverride));
  }, [account.plan, account.featureOverrides, account.maxUsersOverride]);

  const order = meta?.plans ?? ["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"];
  const inPlan = (from: PlanTier) => order.indexOf(from) <= order.indexOf(plan);
  const isOn = (key: string, from: PlanTier) => (key in overrides ? overrides[key]! : inPlan(from));
  const dirty =
    plan !== account.plan ||
    JSON.stringify(overrides) !== JSON.stringify(account.featureOverrides ?? {}) ||
    seats !== (account.maxUsersOverride === null ? "" : String(account.maxUsersOverride));

  // Watch the job the last apply queued, until it settles.
  const jobId = applied?.jobId ?? account.planJobId;
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await apiFetch<{ state: string; message: string }>(`/provision-jobs/${jobId}`);
        if (stop) return;
        setJob(s);
        if (s.state === "queued" || s.state === "running") setTimeout(tick, 3000);
      } catch {
        if (!stop) setJob(null);
      }
    };
    void tick();
    return () => { stop = true; };
  }, [jobId]);

  const toggle = (key: string, from: PlanTier) => {
    const next = { ...overrides };
    const want = !isOn(key, from);
    // An override that matches the plan is no override: removed, so a
    // later plan change is not blocked by a stale "on".
    if (want === inPlan(from)) delete next[key];
    else next[key] = want;
    setOverrides(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/accounts/${account.id}`, {
        method: "PUT",
        data: { plan, featureOverrides: overrides, maxUsersOverride: seats === "" ? null : Number(seats) },
      });
      toast.success("Saved. Apply it to the clinic when ready.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const labelOf = (k: string) => meta?.features.find((f) => f.key === k)?.label ?? k;
  const apply = async () => {
    // Taking a module away from a live clinic is allowed -- it may be the
    // deal -- but never by surprise. An old clinic runs every legacy
    // module until its first apply.
    if (wouldRemove.length > 0 && !window.confirm(`Applying this switches off, for ${account.name}: ${wouldRemove.map(labelOf).join(", ")}.

They use these now. Continue?`)) return;
    setApplying(true);
    try {
      const res = await apiFetch<{ envLines: string; queued: boolean; jobId: string | null }>(`/accounts/${account.id}/apply-plan`, { method: "POST", data: { confirmRemovals: wouldRemove.length > 0 } });
      setApplied(res);
      toast.success(res.queued ? "Sent to the clinic's server." : "Recorded. Apply the lines below on the server by hand.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not apply.");
    } finally {
      setApplying(false);
    }
  };

  const canApply = account.status === "LIVE" || account.status === "SUSPENDED" || account.status === "ONBOARDING";
  const seatsFromPlan = meta?.planSeats?.[plan];

  return (
    <Panel
      title="Plan and modules"
      icon={Boxes}
      action={account.appliedPlan
        ? <span className="text-xs text-muted-foreground">Clinic runs: {PLAN_LABEL[account.appliedPlan]}{account.appliedReadOnly ? ", read-only" : ""}</span>
        : <span className="text-xs text-muted-foreground">Not applied yet</span>}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {order.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              aria-pressed={plan === p}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${plan === p ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"}`}
            >
              <span className="block text-sm font-semibold">{PLAN_LABEL[p]}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{meta?.planFits?.[p]}</span>
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Always included: {(meta?.alwaysIncluded ?? []).join(" · ")}
          </p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {(meta?.features ?? []).map((f) => {
              const on = isOn(f.key, f.from);
              const overridden = f.key in overrides;
              return (
                <li key={f.key} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    id={`mod-${f.key}`}
                    checked={on}
                    onChange={() => toggle(f.key, f.from)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  <label htmlFor={`mod-${f.key}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="text-sm">{f.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{f.description}</span>
                  </label>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {overridden ? (on ? "added to this deal" : "removed from this deal") : `from ${PLAN_LABEL[f.from]}`}
                  </span>
                  {f.built === false && <Badge variant="outline">coming</Badge>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="seats">Logins (leave empty for the plan's {seatsFromPlan === null ? "unlimited" : seatsFromPlan})</Label>
          <Input id="seats" type="number" min="0" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="Plan default" className="tabular" />
          <p className="text-[11px] text-muted-foreground">0 means unlimited.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={!dirty} loading={saving} onClick={save}>Save</Button>
          <Button disabled={dirty || !canApply || (!pendingApply && !!account.appliedPlan)} loading={applying} onClick={apply}>
            Apply to clinic
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Save first.</span>}
          {!dirty && pendingApply && canApply && (
            <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> The clinic is not running this yet.</span>
          )}
          {!dirty && !pendingApply && account.appliedPlan && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" /> The clinic runs this.</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">Enabled: {features.length ? features.join(", ") : "only what every plan includes"}</p>
        {wouldRemove.length > 0 && (
          <p className="flex items-start gap-1 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Applying switches off what the clinic has now: {wouldRemove.map(labelOf).join(", ")}. Tick them to keep them.
          </p>
        )}

        {job && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {(job.state === "queued" || job.state === "running") && <Loader2 className="size-3.5 animate-spin" />}
            Server: {job.state} {job.message ? `· ${job.message}` : ""}
          </p>
        )}
        {applied && !applied.queued && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">No job runner here, so nothing reached the clinic. Put these lines in its env file and recreate its container:</p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[11px]">{applied.envLines}</pre>
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * The deal: how the clinic pays, how much, and who the invoice is to.
 */
export function DealPanel({ account, meta, monthlyValue, onSaved }: {
  account: Account; meta: Meta | null; monthlyValue: number; onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const initial = useMemo(() => ({
    status: account.status,
    pricingModel: account.pricingModel,
    billingCycle: account.billingCycle,
    setupFee: num(account.setupFee),
    yearlyFee: num(account.yearlyFee),
    monthlyFee: num(account.monthlyFee),
    licenceFee: num(account.licenceFee),
    amcPercent: num(account.amcPercent),
    hostingFee: num(account.hostingFee),
    billingName: account.billingName ?? "",
    billingAddress: account.billingAddress ?? "",
    gstin: account.gstin ?? "",
    billingState: account.billingState ?? "",
  }), [account]);
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setF(initial), [initial]);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const list = meta?.listPrices?.[account.plan];

  const useListPrice = () => {
    if (!list) return;
    setF({
      ...f,
      setupFee: String(list.setupFee), yearlyFee: String(list.yearlyFee), monthlyFee: String(list.monthlyFee),
      licenceFee: String(list.licenceFee), amcPercent: String(list.amcPercent),
    });
  };

  const save = async () => {
    setSaving(true);
    const n = (v: string) => (v === "" ? null : Number(v));
    try {
      await apiFetch(`/accounts/${account.id}`, {
        method: "PUT",
        data: {
          status: f.status,
          pricingModel: f.pricingModel,
          billingCycle: f.billingCycle,
          setupFee: n(f.setupFee), yearlyFee: n(f.yearlyFee), monthlyFee: n(f.monthlyFee),
          licenceFee: n(f.licenceFee), amcPercent: n(f.amcPercent), hostingFee: n(f.hostingFee),
          billingName: f.billingName || null, billingAddress: f.billingAddress || null,
          gstin: f.gstin, billingState: f.billingState || null,
        },
      });
      toast.success(f.status !== account.status && (f.status === "SUSPENDED" || account.status === "SUSPENDED")
        ? (f.status === "SUSPENDED" ? "Suspended. The clinic is being made read-only." : "Resumed. The clinic can make changes again.")
        : "Saved.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof f, label: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`deal-${k}`}>{label}</Label>
      <Input id={`deal-${k}`} type="number" min="0" value={f[k]} onChange={set(k)} className="tabular" />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Panel title="Deal" icon={Wallet} action={<span className="text-xs text-muted-foreground tabular">{money(monthlyValue)}/month recurring</span>}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="deal-status">Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as typeof f.status })}>
            <SelectTrigger id="deal-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(meta?.statuses ?? []).map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.status === "SUSPENDED" && account.status !== "SUSPENDED" && (
            <p className="text-[11px] text-warning">Saving makes the clinic read-only straight away. Its records stay viewable and exportable.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="deal-model">How they pay</Label>
          <Select value={f.pricingModel} onValueChange={(v) => setF({ ...f, pricingModel: v as PricingModel })}>
            <SelectTrigger id="deal-model"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRICING_LABEL) as PricingModel[]).map((m) => <SelectItem key={m} value={m}>{PRICING_LABEL[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {f.pricingModel === "SETUP_YEARLY" && (
          <div className="grid grid-cols-2 gap-3">
            {field("setupFee", "Setup fee (₹)", "Once")}
            {field("yearlyFee", "Yearly fee (₹)", "Each year")}
          </div>
        )}
        {f.pricingModel === "SUBSCRIPTION" && (
          <div className="grid grid-cols-2 gap-3">
            {field("monthlyFee", "Monthly fee (₹)")}
            <div className="space-y-1.5">
              <Label htmlFor="deal-cycle">Billed</Label>
              <Select value={f.billingCycle} onValueChange={(v) => setF({ ...f, billingCycle: v as typeof f.billingCycle })}>
                <SelectTrigger id="deal-cycle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUAL">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("setupFee", "Setup fee (₹)", "Optional, once")}
          </div>
        )}
        {f.pricingModel === "LICENCE_AMC" && (
          <div className="grid grid-cols-2 gap-3">
            {field("licenceFee", "Licence (₹)", "Once")}
            {field("amcPercent", "AMC (% of licence)", "Each year")}
            {field("hostingFee", "Hosting (₹ a year)", "Charged at cost")}
          </div>
        )}
        {list && (
          <button type="button" onClick={useListPrice} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Use the {PLAN_LABEL[account.plan]} list price (₹{list.setupFee.toLocaleString("en-IN")} setup + ₹{list.yearlyFee.toLocaleString("en-IN")} a year)
          </button>
        )}

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs font-medium">Invoice to</p>
          <div className="space-y-1.5">
            <Label htmlFor="deal-bname">Legal name</Label>
            <Input id="deal-bname" value={f.billingName} onChange={set("billingName")} placeholder={account.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deal-baddr">Address</Label>
            <Input id="deal-baddr" value={f.billingAddress} onChange={set("billingAddress")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-gstin">GSTIN</Label>
              <Input id="deal-gstin" value={f.gstin} onChange={set("gstin")} placeholder="If registered" className="font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-state">State</Label>
              <Select value={f.billingState || undefined} onValueChange={(v) => setF({ ...f, billingState: v })} disabled={!!f.gstin}>
                <SelectTrigger id="deal-state"><SelectValue placeholder={f.gstin ? "From the GSTIN" : "Choose"} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(meta?.states ?? {}).map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">GST is 18%: CGST + SGST in your own state, IGST anywhere else.</p>
        </div>

        <Button className="w-full" disabled={!dirty} loading={saving} onClick={save}>Save deal</Button>
      </div>
    </Panel>
  );
}

const STATUS_BADGE: Record<Invoice["status"], "outline" | "warning" | "success" | "destructive"> = {
  DRAFT: "outline", ISSUED: "warning", PAID: "success", VOID: "destructive",
};

/**
 * Nayaversse's invoices to this clinic.
 *
 * Drafts can be deleted. Issuing numbers and freezes one; after that it
 * can only be marked paid or voided with a reason.
 */
export function InvoicesPanel({ account, onChanged }: { account: Account; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [pay, setPay] = useState({ paymentMode: "UPI", paymentRef: "", paidAt: "" });

  const load = useCallback(async () => {
    try {
      setInvoices((await apiFetch<{ invoices: Invoice[] }>(`/accounts/${account.id}/invoices`)).invoices);
    } catch {
      setInvoices([]);
    }
  }, [account.id]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.success(done);
      await load();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "That did not work.");
    }
  };

  const hasFirst = (invoices ?? []).some((i) => i.isFirst && i.status !== "VOID");

  return (
    <Panel
      title="Invoices"
      icon={FileText}
      action={
        <div className="flex gap-2">
          {!hasFirst && (
            <Button size="sm" variant="outline" onClick={() => act(() => apiFetch(`/accounts/${account.id}/invoices`, { method: "POST", data: { kind: "first" } }), "First invoice drafted.")}>
              Draft first invoice
            </Button>
          )}
          {hasFirst && (
            <Button size="sm" variant="outline" onClick={() => act(() => apiFetch(`/accounts/${account.id}/invoices`, { method: "POST", data: { kind: "renewal" } }), "Renewal drafted.")}>
              Draft renewal
            </Button>
          )}
        </div>
      }
    >
      {account.renewsAt && (
        <p className="mb-3 text-xs text-muted-foreground">
          Paid up to {new Date(account.renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
        </p>
      )}
      {invoices === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet. Fill in the deal, then draft the first invoice: it carries the one-time fee and the first period.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-mono">{i.number ?? "Draft"}</span>
                  <span className="text-muted-foreground"> · {i.isFirst ? "first" : "renewal"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {i.issuedAt ? `Issued ${new Date(i.issuedAt).toLocaleDateString("en-IN")}` : `Drafted ${new Date(i.createdAt).toLocaleDateString("en-IN")}`}
                  {i.dueAt && i.status === "ISSUED" ? ` · due ${new Date(i.dueAt).toLocaleDateString("en-IN")}` : ""}
                  {i.paidAt ? ` · paid ${new Date(i.paidAt).toLocaleDateString("en-IN")} by ${i.paymentMode}` : ""}
                </p>
              </div>
              <span className="text-sm font-medium tabular">{money(i.total)}</span>
              <Badge variant={STATUS_BADGE[i.status]}>{i.status.toLowerCase()}</Badge>
              <div className="flex gap-1.5">
                <Link to={`/invoices/${i.id}`} className="rounded-md px-2 py-1 text-xs underline underline-offset-4 hover:bg-accent/60">View</Link>
                {i.status === "DRAFT" && (
                  <>
                    <Button size="sm" onClick={() => act(() => apiFetch(`/invoices/${i.id}/issue`, { method: "POST", data: {} }), "Issued.")}>Issue</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => apiFetch(`/invoices/${i.id}`, { method: "DELETE" }), "Draft deleted.")}>Delete</Button>
                  </>
                )}
                {i.status === "ISSUED" && (
                  <>
                    <Button size="sm" onClick={() => { setPaying(i); setPay({ paymentMode: "UPI", paymentRef: "", paidAt: "" }); }}>Mark paid</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = window.prompt("Why is this invoice being voided? The reason is kept with it.");
                        if (reason) void act(() => apiFetch(`/invoices/${i.id}/void`, { method: "POST", data: { reason } }), "Voided.");
                      }}
                    >
                      Void
                    </Button>
                  </>
                )}
              </div>
              {paying?.id === i.id && (
                <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="pay-mode">Paid by</Label>
                    <Select value={pay.paymentMode} onValueChange={(v) => setPay({ ...pay, paymentMode: v })}>
                      <SelectTrigger id="pay-mode" className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["UPI", "NEFT", "RTGS", "IMPS", "CHEQUE", "CASH", "CARD", "OTHER"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay-ref">Reference</Label>
                    <Input id="pay-ref" value={pay.paymentRef} onChange={(e) => setPay({ ...pay, paymentRef: e.target.value })} placeholder="UTR or cheque no." className="w-44" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay-date">On</Label>
                    <Input id="pay-date" type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} className="w-40" />
                  </div>
                  <Button size="sm" onClick={() => act(async () => {
                    await apiFetch(`/invoices/${i.id}/pay`, { method: "POST", data: { paymentMode: pay.paymentMode, paymentRef: pay.paymentRef || undefined, paidAt: pay.paidAt ? new Date(`${pay.paidAt}T12:00:00`).toISOString() : undefined } });
                    setPaying(null);
                  }, "Marked paid.")}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPaying(null)}>Cancel</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Every plan change and whether it reached the clinic. */
export function PlanHistory({ accountId, refreshKey }: { accountId: string; refreshKey: string }) {
  const [changes, setChanges] = useState<PlanChange[]>([]);
  useEffect(() => {
    apiFetch<{ changes: PlanChange[] }>(`/accounts/${accountId}/plan-changes`).then((r) => setChanges(r.changes)).catch(() => {});
  }, [accountId, refreshKey]);
  if (changes.length === 0) return null;
  return (
    <Panel title="Plan history" icon={History}>
      <ul className="space-y-2.5 text-xs">
        {changes.map((c) => (
          <li key={c.id}>
            <p>
              <span className="font-medium">{c.fromPlan ? `${PLAN_LABEL[c.fromPlan]} → ` : ""}{PLAN_LABEL[c.toPlan]}</span>
              {c.readOnly && <span className="text-warning"> · read-only</span>}
              {c.reason && <span className="text-muted-foreground"> · {c.reason}</span>}
            </p>
            <p className="text-muted-foreground">{c.actorName} · {new Date(c.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{c.jobId ? "" : " · applied by hand"}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Quotations and agreements attached to this clinic account.
 *
 * Lives on the account detail page so the deal and the running clinic
 * are visible together. "New quotation" prefills the form with this
 * clinic's name, address, GSTIN and contact; "Open" jumps to the full
 * editor for one. When there are no quotes at all, the empty state
 * says what to do next rather than pretending there is history.
 */
export function QuotationsPanel({ account }: { account: Account }) {
  const [rows, setRows] = useState<Array<{
    id: string;
    number: string | null;
    status: string;
    stage: string;
    title: string;
    total: string;
    nextFollowUpAt: string | null;
    sentAt: string | null;
    createdAt: string;
  }> | null>(null);

  useEffect(() => {
    apiFetch<{ quotations: typeof rows }>(`/quotations?accountId=${account.id}`)
      .then((r) => setRows(r.quotations ?? []))
      .catch(() => setRows([]));
  }, [account.id]);

  // Prefill a few fields a new quote already knows about this account.
  const newQuoteHref = useMemo(() => {
    const params = new URLSearchParams({
      accountId: account.id,
      clientName: account.name,
      ...(account.billingName ? { clientNameLegal: account.billingName } : {}),
      ...(account.billingAddress ? { clientAddress: account.billingAddress } : {}),
      ...(account.gstin ? { clientGSTIN: account.gstin } : {}),
      ...(account.billingState ? { clientState: account.billingState } : {}),
      ...(account.contactEmail ? { clientEmail: account.contactEmail } : {}),
      ...(account.contactPhone ? { clientPhone: account.contactPhone } : {}),
      planTier: account.plan,
    });
    return `/quotations/new?${params.toString()}`;
  }, [account]);

  return (
    <Panel
      title="Quotations"
      icon={FileText}
      action={
        <Button size="sm" variant="outline" asChild>
          <Link to={newQuoteHref}>New quotation</Link>
        </Button>
      }
    >
      {rows === null ? (
        <p className="text-sm italic text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No quotations yet. "New quotation" opens a draft prefilled from this account.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((q) => (
            <li key={q.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <Link to={`/quotations/${q.id}`} className="font-medium hover:underline">
                  {q.number ?? "Draft"} · {q.title}
                </Link>
                <p className="text-[11px] text-muted-foreground">
                  {q.status} · {q.stage.replace("_", " ")}
                  {q.nextFollowUpAt
                    ? ` · chase ${new Date(q.nextFollowUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : ""}
                </p>
              </div>
              <span className="tabular text-sm">{money(q.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
