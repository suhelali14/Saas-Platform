import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Rocket, CheckCircle2, Circle, Wallet, Activity,
  History, Globe, Copy, Check, AlertTriangle, Loader2, KeyRound,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  // Aliased: the type and this page's component share a name.
  type AccountDetail as Detail,
  type Meta, type PlanTier, type AccountStatus,
  STATUS_VARIANT, PLAN_VARIANT, money,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type JobStatus = {
  id: string;
  state: "queued" | "running" | "succeeded" | "failed";
  message: string;
  password?: string;
  loginEmail?: string;
  apiHost?: string;
};

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Detail>(`/accounts/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this clinic.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { apiFetch<Meta>("/meta").then(setMeta).catch(() => {}); }, []);

  const save = async (patch: Record<string, unknown>) => {
    await apiFetch(`/accounts/${id}`, { method: "PUT", data: patch });
    toast.success("Saved.");
    await load();
  };

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading clinic">
        <span className="sr-only">Loading clinic</span>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const a = data.account;

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{a.name}</h1>
            <Badge variant={STATUS_VARIANT[a.status]}>{a.status.toLowerCase()}</Badge>
            <Badge variant={PLAN_VARIANT[a.plan]}>{a.plan.toLowerCase()}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {a.slug}{a.city ? ` · ${a.city}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular">{money(a.monthlyFee, a.currency)}</p>
          <p className="text-xs text-muted-foreground">{a.billingCycle.toLowerCase()}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Provisioning account={a} meta={meta} onDone={load} />
          <Checklist accountId={a.id} steps={a.steps} onChange={load} />
          <Addresses account={a} meta={meta} onSave={save} onChanged={load} />
        </div>
        <div className="space-y-4">
          <Deal account={a} meta={meta} onSave={save} />
          <Health account={a} />
          <ActivityFeed entries={a.activity} />
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      All clinics
    </Link>
  );
}

function Panel({
  title, icon: Icon, action, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
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

/**
 * One-click provisioning.
 *
 * The request returns as soon as the job is queued rather than holding a
 * connection open: creating a Neon project, migrating, issuing a
 * certificate and starting a container together take longer than any
 * sensible HTTP timeout, and a dropped request must never leave the
 * operator unsure whether a clinic was created.
 */
function Provisioning({
  account, meta, onDone,
}: {
  account: Detail["account"];
  meta: Meta | null;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [doctorName, setDoctorName] = useState(account.contactName ?? "");
  const [doctorEmail, setDoctorEmail] = useState(account.contactEmail ?? "");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // Stop polling when the component goes away, or a finished clinic
  // keeps a timer running for as long as the tab is open.
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const poll = useCallback(
    async (jobId: string) => {
      try {
        // accountId lets the API write a finished job back onto the
        // record, so closing this tab cannot leave a provisioned
        // clinic looking un-provisioned.
        const status = await apiFetch<JobStatus>(
          `/provision-jobs/${jobId}?accountId=${encodeURIComponent(account.id)}`,
        );
        setJob(status);
        if (status.state === "queued" || status.state === "running") {
          timer.current = window.setTimeout(() => void poll(jobId), 2500);
        } else {
          if (status.state === "succeeded") toast.success(`${account.name} is live.`);
          else toast.error("Provisioning failed.");
          await onDone();
        }
      } catch {
        // A single failed poll is not a failed provision -- the runner
        // is still working. Try again rather than reporting an error.
        timer.current = window.setTimeout(() => void poll(jobId), 4000);
      }
    },
    [account.name, onDone, toast],
  );

  const start = async () => {
    setError(null);
    try {
      const res = await apiFetch<{ jobId: string }>(`/accounts/${account.id}/provision-clinic`, {
        method: "POST",
        data: { doctorName, doctorEmail },
      });
      setOpen(false);
      setJob({ id: res.jobId, state: "queued", message: "Queued" });
      void poll(res.jobId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start provisioning.");
    }
  };

  const provisioningOff = meta?.provisioning && !meta.provisioning.neon;
  // The runner lives on the host, outside this API. If it is not there,
  // a job can still be written and will simply never be picked up --
  // so this is checked before the button is offered, not after.
  const queueDown = meta?.queue && !meta.queue.ok ? meta.queue.reason : null;
  const blocked = Boolean(provisioningOff) || Boolean(queueDown);
  const running = job?.state === "queued" || job?.state === "running";

  if (account.provisionedAt && !job) {
    return (
      <Panel title="Provisioning" icon={Rocket}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" />
          Provisioned {new Date(account.provisionedAt).toLocaleDateString()}
          {account.apiDomain && <span className="font-mono text-xs">· {account.apiDomain}</span>}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Provisioning" icon={Rocket}>
      {job ? (
        <JobProgress job={job} clinicName={account.name} slug={account.slug} domain={meta?.platformDomain} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Creates the database, migrates it, starts this clinic's API, requests a certificate and
            seeds the doctor's login. Takes a couple of minutes.
          </p>
          {provisioningOff && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>No Neon API key is set on the server, so a database cannot be created.</span>
            </div>
          )}
          {queueDown && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{queueDown}</span>
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button className="mt-4" onClick={() => setOpen(true)} disabled={blocked || running}>
            <Rocket />
            Provision this clinic
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provision {account.name}</DialogTitle>
            <DialogDescription>
              This creates a database and starts a server for this clinic. It cannot be undone from here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doctorName">Doctor's name, as it should print</Label>
              <Input
                id="doctorName"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Dr. "
              />
              <p className="text-[11px] text-muted-foreground">
                Appears at the top of every prescription and certificate.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doctorEmail">Doctor's login email</Label>
              <Input
                id="doctorEmail"
                type="email"
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={start} disabled={!doctorName || !doctorEmail}>
              <Rocket />
              Start provisioning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function JobProgress({
  job, clinicName, slug, domain,
}: {
  job: JobStatus;
  clinicName: string;
  slug: string;
  domain?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (job.state === "failed") {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">Provisioning failed</p>
          <p className="mt-1 break-words text-xs opacity-90">{job.message}</p>
        </div>
      </div>
    );
  }

  if (job.state !== "succeeded") {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm" role="status">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div>
          <p className="font-medium">{job.state === "queued" ? "Queued" : "Provisioning"}</p>
          <p className="text-xs text-muted-foreground">{job.message}</p>
        </div>
      </div>
    );
  }

  const base = domain ?? "yourdomain";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" />
        {clinicName} is live.
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label="Patient site" value={`${slug}.${base}`} href={`https://${slug}.${base}`} />
        <Row label="Staff portal" value={`${slug}.portal.${base}`} href={`https://${slug}.portal.${base}`} />
        {job.apiHost && <Row label="API" value={job.apiHost} />}
      </div>

      {job.password && (
        <div className="rounded-md border border-warning/25 bg-warning/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <KeyRound className="size-4" />
            Doctor's password — shown once
          </div>
          <p className="mt-1 text-xs text-warning/80">
            It is not stored anywhere. Copy it now and hand it over; they should change it at first sign-in.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background/60 px-2.5 py-1.5 font-mono text-sm">
              {job.password}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(job.password!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {job.loginEmail && (
            <p className="mt-2 font-mono text-xs text-warning/80">{job.loginEmail}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate font-mono text-xs text-primary hover:underline">
          {value}
        </a>
      ) : (
        <span className="truncate font-mono text-xs">{value}</span>
      )}
    </div>
  );
}

function Checklist({
  accountId, steps, onChange,
}: {
  accountId: string;
  steps: Detail["account"]["steps"];
  onChange: () => Promise<void>;
}) {
  const done = steps.filter((s) => s.done).length;

  const toggle = async (key: string, next: boolean) => {
    await apiFetch(`/accounts/${accountId}/steps/${key}`, { method: "PATCH", data: { done: next } });
    await onChange();
  };

  return (
    <Panel
      title="Onboarding"
      icon={CheckCircle2}
      action={<span className="text-xs tabular text-muted-foreground">{done}/{steps.length}</span>}
    >
      <ul className="space-y-0.5">
        {steps.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => void toggle(s.key, !s.done)}
              className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {s.done
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1">
                <span className={`text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>
                  {s.label}
                </span>
                {/* An operator should never wait on a button that was
                    never going to exist. DNS is always manual -- it is
                    the customer's registrar. */}
                {!s.automated && (
                  <span className="ml-2 text-[11px] text-muted-foreground">manual</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Every address this clinic answers on, and how to change them.
 *
 * Three things live here because an operator thinks of them as one
 * question ("what is this clinic's web address?") even though they behave
 * very differently:
 *
 * - The **slug** is the platform address. Changing it is cheap: both the
 *   old and the new name are covered by the same wildcard certificate, so
 *   there is no DNS work and no re-provisioning. The cost is that the old
 *   address stops working the moment it is saved, and patients may have
 *   been given it.
 * - A **custom domain** is additive. The clinic keeps its platform address
 *   and gains its own, which is what makes it safe to set up before DNS
 *   has propagated. It needs two things this console cannot do, so both
 *   are shown rather than implied.
 * - The **API hostname** is where the clinic's own server answers. It is
 *   not a website and is not a CORS origin; it is set when the clinic is
 *   provisioned and is almost never edited by hand.
 */
function Addresses({
  account, meta, onSave, onChanged,
}: {
  account: Detail["account"];
  meta: Meta | null;
  onSave: (p: Record<string, unknown>) => Promise<void>;
  onChanged: () => void;
}) {
  const platform = meta?.platformDomain ?? "";
  const [slug, setSlug] = useState(account.slug);
  const [publicDomain, setPublicDomain] = useState(account.publicDomain ?? "");
  const [portalDomain, setPortalDomain] = useState(account.portalDomain ?? "");
  const [apiDomain, setApiDomain] = useState(account.apiDomain ?? "");
  const [result, setResult] = useState<DomainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Re-seed when the account reloads, or the inputs would keep showing
  // what was typed before a save that has since been applied.
  useEffect(() => {
    setSlug(account.slug);
    setPublicDomain(account.publicDomain ?? "");
    setPortalDomain(account.portalDomain ?? "");
    setApiDomain(account.apiDomain ?? "");
  }, [account.slug, account.publicDomain, account.portalDomain, account.apiDomain]);

  const clean = (v: string) =>
    v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const slugChanged = slug !== account.slug;
  const domainsChanged =
    clean(publicDomain) !== (account.publicDomain ?? "") ||
    clean(portalDomain) !== (account.portalDomain ?? "");
  const dirty = slugChanged || domainsChanged;

  // Shown live, because a slug is not obviously a hostname until you see
  // it as one. Typing "dr momin" and being told the address would be
  // "dr momin.nayaverse.in" is the fastest way to understand the rule.
  const nextPublic = publicDomain ? clean(publicDomain) : `${slug}.${platform}`;
  const nextPortal = portalDomain ? clean(portalDomain) : `${slug}.portal.${platform}`;

  async function saveAddresses() {
    setError(null);
    setResult(null);
    try {
      const body = await apiFetch<DomainResult>(`/accounts/${account.id}/domains`, {
        method: "PUT",
        body: JSON.stringify({
          slug,
          publicDomain: clean(publicDomain),
          portalDomain: clean(portalDomain),
        }),
      });
      setResult(body);
      toast.success("Addresses saved");
      onChanged();
    } catch (e) {
      // Shown in the panel rather than only as a toast: a refusal here
      // names the clinic already using the address, which is the thing
      // the operator has to act on.
      setError(e instanceof ApiError ? e.message : "Could not save the addresses.");
    }
  }

  return (
    <Panel title="Addresses" icon={Globe}>
      <div className="space-y-5">
        {/* What it is right now, as links, so they can be checked. */}
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
          <LiveAddress label="Patient site" host={account.publicDomain ?? (platform ? `${account.slug}.${platform}` : null)} />
          <LiveAddress label="Staff portal" host={account.portalDomain ?? (platform ? `${account.slug}.portal.${platform}` : null)} />
        </div>

        {/* The platform address. */}
        <div className="space-y-1.5">
          <Label htmlFor="slug">Platform name</Label>
          <div className="flex items-center gap-2">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              className="font-mono"
              placeholder="acme"
            />
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">.{platform || "…"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lowercase letters, numbers and hyphens. Covered by the existing wildcard certificate,
            so a change needs no DNS work and no re-provisioning.
          </p>
        </div>

        {/* The consequence, stated before the save rather than after. */}
        {slugChanged && (
          <Notice tone={account.status === "LIVE" ? "warn" : "info"}>
            {account.status === "LIVE" ? (
              <>
                <strong>{account.slug}.{platform} will stop working immediately.</strong> Anyone
                holding the old address — a patient with a bookmark, a printed card, a Google
                result — gets “no clinic at this address”. The clinic's API hostname is separate
                and is left alone, so nothing has to be re-provisioned.
              </>
            ) : (
              <>This clinic is not live yet, so changing its name costs nothing.</>
            )}
          </Notice>
        )}

        {/* The clinic's own domain. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="publicDomain">Own domain (patient site)</Label>
            <Input
              id="publicDomain"
              value={publicDomain}
              onChange={(e) => setPublicDomain(e.target.value)}
              placeholder="drasifclinic.in"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portalDomain">Own domain (staff portal)</Label>
            <Input
              id="portalDomain"
              value={portalDomain}
              onChange={(e) => setPortalDomain(e.target.value)}
              placeholder="dashboard.drasifclinic.in"
              className="font-mono"
            />
          </div>
        </div>
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Optional, and additive — the platform address keeps working either way. Leave blank
          unless the clinic owns a domain.
        </p>

        {dirty && (
          <div className="rounded-md border border-border/60 p-3 text-xs">
            <p className="mb-1.5 font-medium">After saving</p>
            <p className="font-mono text-[11px] text-muted-foreground">patients → https://{nextPublic}</p>
            <p className="font-mono text-[11px] text-muted-foreground">staff → https://{nextPortal}</p>
          </div>
        )}

        {error && <Notice tone="warn">{error}</Notice>}

        {result && <DomainOutcome result={result} />}

        <div className="flex items-center gap-2">
          <Button disabled={!dirty} onClick={saveAddresses}>Save addresses</Button>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setSlug(account.slug);
                setPublicDomain(account.publicDomain ?? "");
                setPortalDomain(account.portalDomain ?? "");
                setError(null);
                setResult(null);
              }}
            >
              Discard
            </Button>
          )}
        </div>

        {/* The API hostname, kept apart: it is not a website. */}
        <div className="space-y-1.5 border-t border-border/60 pt-4">
          <Label htmlFor="apiDomain">API hostname</Label>
          <div className="flex gap-2">
            <Input
              id="apiDomain"
              value={apiDomain}
              onChange={(e) => setApiDomain(e.target.value)}
              placeholder="acme.api.yourdomain.in"
              className="font-mono"
            />
            <Button
              variant="outline"
              disabled={apiDomain === (account.apiDomain ?? "")}
              onClick={async () => { await onSave({ apiDomain: apiDomain || null }); }}
            >
              Save
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Where this clinic's own server answers. Set automatically when you provision from
            here, and tied to its TLS certificate — changing it by hand will take the clinic
            offline unless that hostname already has a certificate.
          </p>
        </div>
      </div>
    </Panel>
  );
}

type DomainResult = {
  origins: string[];
  jobId: string | null;
  pending: string | null;
  dns: { type: string; name: string; value: string; note: string }[];
};

/**
 * What the save did, and what is left for a human.
 *
 * The queued job is the part that matters and the part an operator would
 * never think to check: a clinic's API only trusts the addresses it was
 * told about at provisioning time, so until that job lands the new
 * address serves the site and then fails every request it makes.
 */
function DomainOutcome({ result }: { result: DomainResult }) {
  const [job, setJob] = useState<JobStatus | null>(null);

  useEffect(() => {
    if (!result.jobId) return;
    let stop = false;
    const poll = async () => {
      try {
        const s = await apiFetch<JobStatus>(`/provision-jobs/${result.jobId}`);
        if (stop) return;
        setJob(s);
        if (s.state === "queued" || s.state === "running") setTimeout(poll, 2000);
      } catch {
        // A job that cannot be read is reported by its absence rather
        // than by a retry loop that never ends.
        if (!stop) setJob(null);
      }
    };
    poll();
    return () => { stop = true; };
  }, [result.jobId]);

  return (
    <div className="space-y-3">
      {result.pending && <Notice tone="warn">{result.pending}</Notice>}

      {result.jobId && (
        <div className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-xs">
          {job?.state === "succeeded" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : job?.state === "failed" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          ) : (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {job?.state === "succeeded"
                ? "The clinic's API now trusts these addresses"
                : job?.state === "failed"
                  ? "The clinic's API was not updated"
                  : "Telling the clinic's API about the new addresses…"}
            </p>
            <p className="mt-0.5 break-words text-muted-foreground">
              {job?.message ?? "Queued."}
            </p>
            {job?.state === "failed" && (
              <p className="mt-1.5 text-muted-foreground">
                The addresses are saved, but until this succeeds the site will load and then fail
                every request with a CORS error. Retry by saving again.
              </p>
            )}
          </div>
        </div>
      )}

      {result.dns.length > 0 && (
        <div className="rounded-md border border-border/60 p-3 text-xs">
          <p className="mb-2 font-medium">Still to do by hand</p>
          <p className="mb-2 text-muted-foreground">
            A custom domain needs two things this console cannot reach: the record below, at the
            clinic's own registrar, and the domain added to the website project.
          </p>
          <div className="space-y-2">
            {result.dns.map((r) => (
              <div key={r.name} className="rounded border border-border/60 bg-muted/20 p-2 font-mono text-[11px]">
                <div>{r.type}  {r.name}  →  {r.value}</div>
                <div className="mt-1 font-sans text-muted-foreground">{r.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveAddress({ label, host }: { label: string; host: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {host ? (
        <a
          href={`https://${host}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-foreground underline-offset-2 hover:underline"
        >
          {host}
        </a>
      ) : (
        <span className="font-mono text-muted-foreground">not configured</span>
      )}
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  const styles =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-border/60 bg-muted/20 text-muted-foreground";
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-xs ${styles}`}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Deal({
  account, meta, onSave,
}: {
  account: Detail["account"];
  meta: Meta | null;
  onSave: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [fee, setFee] = useState(account.monthlyFee ?? "");
  const [status, setStatus] = useState(account.status);
  const [plan, setPlan] = useState<PlanTier>(account.plan);
  const [saving, setSaving] = useState(false);

  const dirty =
    fee !== (account.monthlyFee ?? "") || status !== account.status || plan !== account.plan;

  return (
    <Panel title="Deal" icon={Wallet}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(meta?.statuses ?? []).map((s: AccountStatus) => (
                <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dealPlan">Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as PlanTier)}>
            <SelectTrigger id="dealPlan"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(meta?.plans ?? []).map((p: PlanTier) => (
                <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fee">Monthly fee (₹)</Label>
          <Input
            id="fee"
            type="number"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="tabular"
          />
        </div>

        <Button
          className="w-full"
          disabled={!dirty}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ status, plan, monthlyFee: fee === "" ? null : Number(fee) });
            } finally {
              setSaving(false);
            }
          }}
        >
          Save changes
        </Button>
      </div>
    </Panel>
  );
}

function Health({ account }: { account: Detail["account"] }) {
  const checks = account.health ?? [];
  const latest = checks[0];

  return (
    <Panel title="Health" icon={Activity}>
      {!latest ? (
        <p className="text-sm text-muted-foreground">
          Not polled yet. Only LIVE clinics are checked.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant={latest.ok ? "success" : "destructive"}>
              {latest.ok ? "reachable" : "unreachable"}
            </Badge>
            {latest.latencyMs != null && (
              <span className="text-xs tabular text-muted-foreground">{latest.latencyMs} ms</span>
            )}
          </div>
          {latest.error && (
            <p className="mt-2 break-words text-xs text-destructive">{latest.error}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(latest.checkedAt).toLocaleString()}
          </p>
        </>
      )}
    </Panel>
  );
}

function ActivityFeed({ entries }: { entries: Detail["account"]["activity"] }) {
  return (
    <Panel title="Activity" icon={History}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {entries.slice(0, 12).map((e: Detail["account"]["activity"][number]) => (
            <li key={e.id} className="text-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-foreground">{e.action}</span>
                {/* A rehearsal must never read back as the real thing. */}
                {!e.applied && <Badge variant="outline">dry run</Badge>}
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {e.actorName} · {new Date(e.at).toLocaleString()}
              </p>
              {e.detail && <p className="mt-0.5 break-words text-muted-foreground/80">{e.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
