import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Search, Building2, Wallet, Activity, AlertTriangle, ArrowRight,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  type AccountListItem, type Meta, type PlanTier,
  STATUS_VARIANT, PLAN_VARIANT, money,
} from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/**
 * Every clinic you have sold to, and what state each one is in.
 *
 * The three numbers at the top are the ones that actually matter running
 * this business: how many clinics are live, what they pay in total, and
 * whether any of them is currently down. Everything else is a click away.
 */
export function Accounts() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [mrr, setMrr] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data = await apiFetch<{ accounts: AccountListItem[]; mrr: number }>(
        `/accounts?${params.toString()}`,
      );
      setAccounts(data.accounts);
      setMrr(data.mrr);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load clinics.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per
    // keystroke against a list that is rarely long enough to need it.
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    apiFetch<Meta>("/meta").then(setMeta).catch(() => {
      /* Reference data only -- the list still works without it. */
    });
  }, []);

  const live = accounts.filter((a) => a.status === "LIVE").length;
  const down = accounts.filter((a) => a.lastHealth && !a.lastHealth.ok).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clinics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every clinic you have sold to, and what state each one is in.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Onboard a clinic
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<Building2 className="size-4" />}
          label="Live clinics"
          value={loading ? null : String(live)}
          hint={`${accounts.length} total`}
        />
        <Stat
          icon={<Wallet className="size-4" />}
          label="Monthly recurring"
          value={loading ? null : money(mrr)}
          // Counted from LIVE accounts only. A lead is a hope, not income.
          hint="from live clinics only"
        />
        <Stat
          icon={down > 0 ? <AlertTriangle className="size-4" /> : <Activity className="size-4" />}
          label="Health"
          value={loading ? null : down > 0 ? `${down} down` : "All healthy"}
          hint={down > 0 ? "check the clinic below" : "last poll"}
          tone={down > 0 ? "bad" : "good"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug or city"
            className="pl-9"
            aria-label="Search clinics"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(meta?.statuses ?? []).map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div role="status" aria-label="Loading clinics" className="space-y-2">
          <span className="sr-only">Loading clinics</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px]" />)}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {search || statusFilter !== "all" ? "No clinics match that" : "No clinics yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "Try a different search or clear the filter."
                  : "Onboard your first clinic to get started."}
              </p>
            </div>
            {!search && statusFilter === "all" && (
              <Button onClick={() => setCreating(true)} className="mt-1">
                <Plus />
                Onboard a clinic
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => <AccountRow key={a.id} account={a} />)}
        </div>
      )}

      {creating && (
        <CreateDialog
          meta={meta}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); void load(); }}
        />
      )}
    </div>
  );
}

function Stat({
  icon, label, value, hint, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className={`mt-2 text-2xl font-semibold tabular tracking-tight ${tone === "bad" ? "text-destructive" : ""}`}>
            {value}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function AccountRow({ account: a }: { account: AccountListItem }) {
  const unhealthy = a.lastHealth && !a.lastHealth.ok;
  return (
    <Link
      to={`/clinics/${a.id}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{a.name}</span>
          <Badge variant={STATUS_VARIANT[a.status]}>{a.status.toLowerCase()}</Badge>
          <Badge variant={PLAN_VARIANT[a.plan]}>{a.plan.toLowerCase()}</Badge>
          {unhealthy && (
            <Badge variant="destructive">
              <AlertTriangle className="size-3" />
              unreachable
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {a.slug}
          {a.city ? ` · ${a.city}` : ""}
          {a.contactName ? ` · ${a.contactName}` : ""}
        </p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium tabular">{money(a.monthlyFee, a.currency)}</p>
        <p className="text-xs text-muted-foreground">
          {a.progress.done}/{a.progress.total} steps
        </p>
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}

function CreateDialog({
  meta, onClose, onCreated,
}: {
  meta: Meta | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  // The slug IS the clinic's subdomain, so it has to be deliberate
  // rather than derived from a legal name: "Dr Asif's Family Clinic Pvt
  // Ltd" slugifies to something nobody wants to read out over the phone.
  // It is also effectively permanent -- changing it later would move
  // every URL the clinic has given to patients.
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState<PlanTier>("STANDARD");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggested = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  useEffect(() => {
    if (!slugEdited) setSlug(suggested);
  }, [suggested, slugEdited]);

  useEffect(() => {
    if (meta?.suggestedFees) setMonthlyFee(String(meta.suggestedFees[plan]));
  }, [plan, meta]);

  const domain = meta?.platformDomain ?? "yourdomain";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/accounts", {
        method: "POST",
        data: {
          name,
          slug: slug || undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          city: city || undefined,
          plan,
          monthlyFee: monthlyFee ? Number(monthlyFee) : undefined,
        },
      });
      toast.success(`${name} added.`);
      onCreated();
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Could not create the account.";
      setError(m);
      toast.error(m);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard a clinic</DialogTitle>
          <DialogDescription>
            This creates the account. Provisioning the database and server comes next, from the clinic's page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Clinic name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Subdomain</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              required
              placeholder="acme"
              className="font-mono"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {slug ? (
                <>
                  Patients <span className="font-mono text-foreground">{slug}.{domain}</span>
                  {" · "}
                  Staff <span className="font-mono text-foreground">{slug}.portal.{domain}</span>
                </>
              ) : (
                "Becomes the clinic's web address. Keep it short."
              )}
              <br />
              Cannot be changed later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contactName">Contact person</Label>
              <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactEmail">Email</Label>
              <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plan</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as PlanTier)}>
                <SelectTrigger id="plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(meta?.plans ?? ["BASIC", "STANDARD", "PREMIUM"]).map((p) => (
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
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                className="tabular"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {saving ? "Creating…" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
