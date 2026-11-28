import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Copy, Gift, MessageCircle, Pencil, Plus, Search } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { money } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/*
 * Nayaverse Growth, sold and run from the console (Growth's D54). Prices,
 * the yearly discount and what each plan opens live here; Growth's
 * businesses, welcome links and requests are read from Growth's server over
 * signed calls, and plans given by hand are sent to it the same way.
 */

interface Offer {
  id: string;
  code: string;
  kind: "plan" | "module" | "custom";
  name: string;
  summary: string;
  includes: string[];
  grants: { modules?: string[]; videosMonth?: number; aiSecondsMonth?: number };
  monthlyPricePaise: number | null;
  yearlyDiscountPct: number | null;
  effectiveYearlyDiscountPct: number;
  yearlyPricePaise: number | null;
  published: boolean;
  accountName: string | null;
  updatedBy: string | null;
}

interface Catalog {
  defaultYearlyDiscountPct: number;
  modules: Record<string, string>;
  offers: Offer[];
}

interface Business {
  id: string;
  name: string;
  kind: string;
  city: string;
  cameFrom: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  modules: string[];
  plans: string[];
  until: string | null;
}

interface Welcome {
  business: string;
  email: string;
  source: "clinic" | "desk";
  gift: boolean;
  by: string;
  at: string;
  expiresAt: string;
  usedAt: string | null;
}

interface PlanRequest {
  id: string;
  businessId: string;
  business: string;
  note: string;
  by: string;
  at: string;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const rupees = (paise: number | null) => (paise == null ? "—" : money(paise / 100));
const KINDS: Record<string, string> = { salon: "Salon", spa: "Spa", gym: "Gym", coaching: "Coaching", restaurant: "Restaurant", services: "Services", clinic: "Clinic", startup: "Product" };

function Section({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 max-w-[80ch] text-sm text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Whether Growth really accepts this console (GET /growth/check). */
interface GrowthCheck {
  configured: boolean;
  ok: boolean;
  consolePublicKey: string | null;
  error: string | null;
}

/** What is wrong between this console and Growth, and the one thing to do
 *  about it. Shown only while Growth does not accept the console. */
function ConnectionProblem({ check, onRecheck }: { check: GrowthCheck; onRecheck: () => void }) {
  const toast = useToast();
  return (
    <div role="alert" className="space-y-3 rounded-md border border-destructive/25 bg-destructive/10 p-4 text-sm">
      <div className="flex items-start gap-2 text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="font-medium">{check.error}</p>
      </div>
      {!check.configured ? (
        <p className="text-muted-foreground">
          Set GROWTH_URL and GROWTH_PUBLIC_KEY on the console, and CONSOLE_URL, CONSOLE_PUBLIC_KEY and GROWTH_SIGNING_KEY on Growth, to connect them.
        </p>
      ) : (
        check.consolePublicKey && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              On Growth's server, set CONSOLE_PUBLIC_KEY to this console's public key below, then restart Growth. It is public: safe to copy and paste anywhere.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-border bg-background px-2 py-1.5 font-mono text-xs">{check.consolePublicKey}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(check.consolePublicKey!);
                  toast.success("Copied.");
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
          </div>
        )
      )}
      <Button size="sm" variant="ghost" onClick={onRecheck}>Check again</Button>
    </div>
  );
}

export function Growth() {
  const toast = useToast();
  const [check, setCheck] = useState<GrowthCheck | null>(null);
  const [mode, setMode] = useState("off");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [bizError, setBizError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Offer | null>(null);
  const [granting, setGranting] = useState<Business | null>(null);
  const [custom, setCustom] = useState<{ id: string; name: string } | null>(null);
  const [discount, setDiscount] = useState("");

  const loadCatalog = () =>
    apiFetch<Catalog>("/catalog?product=GROWTH").then((c) => {
      setCatalog(c);
      setDiscount(String(c.defaultYearlyDiscountPct));
    });
  const loadBusinesses = (query = q) =>
    apiFetch<{ businesses: Business[] }>(`/growth/businesses?q=${encodeURIComponent(query)}`).then(
      (r) => {
        setBusinesses(r.businesses);
        setBizError(null);
      },
      (e) => setBizError(e instanceof ApiError ? e.message : "Growth did not answer."),
    );

  useEffect(() => {
    apiFetch<{ mode: string }>("/billing-settings").then((s) => setMode(s.mode));
    recheck();
    loadCatalog();
    loadBusinesses("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recheck = () =>
    apiFetch<GrowthCheck>("/growth/check").then(
      (c) => setCheck(c),
      () => setCheck({ configured: false, ok: false, consolePublicKey: null, error: "The console could not check Growth." }),
    );

  const saveDiscount = async () => {
    try {
      await apiFetch("/billing-settings", { method: "PUT", data: { yearlyDiscountPct: Number(discount) } });
      toast.success("Yearly discount saved.");
      loadCatalog();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not save.");
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nayaverse Growth</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plans and prices, subscriptions, and Growth's businesses, from one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={mode === "razorpay" ? "success" : mode === "test" ? "warning" : "outline"}>
            {mode === "razorpay" ? "Razorpay" : mode === "test" ? "Test payments" : "Payments off"}
          </Badge>
          <Badge variant={check?.ok ? "success" : "destructive"}>
            {check === null ? "…" : check.ok ? "Growth connected" : check.configured ? "Growth refuses the console" : "Growth not connected"}
          </Badge>
        </div>
      </div>

      {check && !check.ok && <ConnectionProblem
          check={check}
          onRecheck={() => {
            recheck();
            loadBusinesses();
          }}
        />}

      <Section
        title="Businesses"
        sub="Every Growth account: where it came from, and what is open for it now."
        action={
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadBusinesses();
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input aria-label="Search businesses" placeholder="Name or city" className="h-9 w-56 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
        }
      >
        <Card>
          <CardContent className="p-0">
            {check && !check.ok ? (
              <p className="p-5 text-sm text-muted-foreground">Shown once Growth accepts this console (above).</p>
            ) : bizError ? (
              <p className="p-5 text-sm text-destructive">{bizError}</p>
            ) : !businesses ? (
              <div className="space-y-2 p-5"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
            ) : businesses.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No businesses yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Business</th>
                      <th className="px-3 py-2.5 font-medium">Owner</th>
                      <th className="px-3 py-2.5 font-medium">Open now</th>
                      <th className="px-3 py-2.5 font-medium">Until</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {businesses.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3">
                          <span className="block font-medium">{b.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[KINDS[b.kind] ?? b.kind, b.city].filter(Boolean).join(" · ")}
                            {b.cameFrom === "clinic" ? " · from Nayaverse Clinic" : b.cameFrom === "desk" ? " · welcome link" : ""}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className="block">{b.ownerName}</span>
                          <span className="text-muted-foreground">{b.ownerEmail}</span>
                        </td>
                        <td className="px-3 py-3">
                          {b.modules.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Nothing</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {b.modules.map((m) => (
                                <Badge key={m} variant="primary">{catalog?.modules[m] ?? m}</Badge>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs tabular">{date(b.until)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setGranting(b)}>
                              <Gift /> Give a plan
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setCustom({ id: b.id, name: b.name })}>
                              <Plus /> Custom plan
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="Plans and prices" sub="What owners see on Growth's Plans page. A price is a month; the yearly price is twelve months less the discount. Nothing shows to owners until it has a price and is on sale.">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-5">
            <div>
              <Label htmlFor="yearly">Yearly discount, %</Label>
              <Input id="yearly" inputMode="decimal" className="mt-1 h-9 w-28" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <Button onClick={saveDiscount} disabled={discount.trim() === "" || Number.isNaN(Number(discount))}>Save</Button>
            <p className="text-xs text-muted-foreground">For every plan, unless a plan sets its own. Changes apply to new subscriptions; running ones keep their price.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            {!catalog ? (
              <div className="p-5"><Skeleton className="h-24 w-full" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Plan or module</th>
                      <th className="px-3 py-2.5 font-medium">Opens</th>
                      <th className="px-3 py-2.5 text-right font-medium">A month</th>
                      <th className="px-3 py-2.5 text-right font-medium">A year</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {catalog.offers.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-3">
                          <span className="block font-medium">{o.name}</span>
                          <span className="text-xs text-muted-foreground">{o.kind === "custom" ? `Made for ${o.accountName}` : o.kind === "plan" ? "Plan" : "Single module"}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {(o.grants.modules ?? []).map((m) => catalog.modules[m] ?? m).join(", ") || "—"}
                          {o.grants.videosMonth ? ` · ${o.grants.videosMonth} videos a month` : ""}
                          {o.grants.aiSecondsMonth ? ` · ${o.grants.aiSecondsMonth}s AI` : ""}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular">{rupees(o.monthlyPricePaise)}</td>
                        <td className="px-3 py-3 text-right tabular">
                          {rupees(o.yearlyPricePaise)}
                          {o.yearlyPricePaise != null && o.effectiveYearlyDiscountPct > 0 && <span className="block text-[11px] text-muted-foreground">{o.effectiveYearlyDiscountPct}% off{o.yearlyDiscountPct != null ? " (own)" : ""}</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={o.published && o.monthlyPricePaise ? "success" : "outline"}>{o.published && o.monthlyPricePaise ? "On sale" : "Off sale"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>
                            <Pencil /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      <WelcomeLinks />
      <Requests onMake={(id, name) => setCustom({ id, name })} />

      {editing && catalog && <OfferDialog offer={editing} modules={catalog.modules} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadCatalog(); }} />}
      {custom && catalog && <OfferDialog custom={custom} modules={catalog.modules} onClose={() => setCustom(null)} onSaved={() => { setCustom(null); loadCatalog(); }} />}
      {granting && catalog && <GrantDialog business={granting} offers={catalog.offers} onClose={() => setGranting(null)} onDone={() => { setGranting(null); loadBusinesses(); }} />}
    </div>
  );
}

function OfferDialog({ offer, custom, modules, onClose, onSaved }: { offer?: Offer; custom?: { id: string; name: string }; modules: Record<string, string>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: offer?.name ?? "",
    summary: offer?.summary ?? "",
    includes: (offer?.includes ?? []).join("\n"),
    modules: offer?.grants.modules ?? [],
    videosMonth: String(offer?.grants.videosMonth ?? 0),
    aiSecondsMonth: String(offer?.grants.aiSecondsMonth ?? 0),
    price: offer?.monthlyPricePaise ? String(offer.monthlyPricePaise / 100) : "",
    yearly: offer?.yearlyDiscountPct != null ? String(offer.yearlyDiscountPct) : "",
    published: offer?.published ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: f.name,
      summary: f.summary,
      includes: f.includes.split("\n").map((l) => l.trim()).filter(Boolean),
      modules: f.modules,
      videosMonth: Number(f.videosMonth) || 0,
      aiSecondsMonth: Number(f.aiSecondsMonth) || 0,
      priceRupees: f.price.trim() ? Math.round(Number(f.price.replace(/,/g, ""))) : null,
      yearlyDiscountPct: f.yearly.trim() ? Number(f.yearly) : null,
      published: f.published,
    };
    try {
      if (offer) await apiFetch(`/catalog/${encodeURIComponent(offer.id)}`, { method: "PUT", data: body });
      else await apiFetch("/catalog/custom", { method: "POST", data: { ...body, product: "GROWTH", accountRef: custom!.id, accountName: custom!.name } });
      toast.success(offer ? `${f.name} saved.` : `Made. It shows first on ${custom!.name}'s Plans page.`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{offer ? `Edit ${offer.name}` : `A plan for ${custom!.name}`}</DialogTitle>
            <DialogDescription>{offer ? "Changes apply to new subscriptions; a running one keeps what it was bought with." : "Only this business sees it, first on its Plans page, monthly or yearly."}</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div>
            <Label htmlFor="o-name">Name</Label>
            <Input id="o-name" className="mt-1" maxLength={60} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="o-sum">One line under the name</Label>
            <Input id="o-sum" className="mt-1" maxLength={160} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </div>
          <div>
            <Label>Opens</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(modules).map(([k, v]) => {
                const on = f.modules.includes(k);
                return (
                  <Button key={k} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => setF({ ...f, modules: on ? f.modules.filter((x) => x !== k) : [...f.modules, k] })}>
                    {v}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="o-vid">Videos a month</Label>
              <Input id="o-vid" className="mt-1" inputMode="numeric" value={f.videosMonth} onChange={(e) => setF({ ...f, videosMonth: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="o-ai">AI seconds a month</Label>
              <Input id="o-ai" className="mt-1" inputMode="numeric" value={f.aiSecondsMonth} onChange={(e) => setF({ ...f, aiSecondsMonth: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="o-inc">What is included (one line each)</Label>
            <Textarea id="o-inc" className="mt-1" rows={4} value={f.includes} onChange={(e) => setF({ ...f, includes: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="o-price">Price a month, ₹</Label>
              <Input id="o-price" className="mt-1" inputMode="numeric" placeholder="Not set" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="o-yearly">Own yearly discount, %</Label>
              <Input id="o-yearly" className="mt-1" inputMode="decimal" placeholder="The default" value={f.yearly} onChange={(e) => setF({ ...f, yearly: e.target.value })} />
            </div>
          </div>
          {offer && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />
              On sale to owners
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{offer ? "Save" : "Make it"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GrantDialog({ business, offers, onClose, onDone }: { business: Business; offers: Offer[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [offer, setOffer] = useState(offers[0]?.code ?? "");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const give = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/growth/businesses/${encodeURIComponent(business.id)}/grant`, { method: "POST", data: { offerCode: offer, months: Number(months), note } });
      toast.success(`Given to ${business.name}. It shows in its Plans and Activity.`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not give it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={give} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Give {business.name} a plan</DialogTitle>
            <DialogDescription>A free month, or a payment taken another way. Nothing is charged; it shows in the business's Activity with your reason.</DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div>
            <Label>Plan or module</Label>
            <Select value={offer} onValueChange={setOffer}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {offers.map((o) => (
                  <SelectItem key={o.code} value={o.code}>{o.name}{o.kind === "custom" ? ` (for ${o.accountName})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="g-months">Months</Label>
            <Input id="g-months" className="mt-1 w-28" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="g-note">Why</Label>
            <Input id="g-note" className="mt-1" maxLength={200} required placeholder="Paid by bank transfer" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !note.trim()}>Give it</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeLinks() {
  const toast = useToast();
  const [list, setList] = useState<Welcome[] | null>(null);
  const [f, setF] = useState({ businessName: "", kind: "clinic", city: "", language: "en", ownerName: "", ownerEmail: "", ownerPhone: "", gift: true });
  const [link, setLink] = useState<{ url: string; phone: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => apiFetch<{ welcomes: Welcome[] }>("/growth/welcome").then((r) => setList(r.welcomes), () => setList([]));
  useEffect(() => {
    load();
  }, []);
  const make = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await apiFetch<{ url: string }>("/growth/welcome", { method: "POST", data: f });
      setLink({ url: r.url, phone: f.ownerPhone.replace(/\D/g, ""), name: f.ownerName });
      setF({ ...f, businessName: "", city: "", ownerName: "", ownerEmail: "", ownerPhone: "" });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not make the link.");
    } finally {
      setBusy(false);
    }
  };
  const phone = link ? (link.phone.length === 10 ? `91${link.phone}` : link.phone) : "";
  const wa = link ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${link.name}, your Nayaversse Growth account is ready. Open it in one click (Reviews QR is free for a year): ${link.url}`)}` : "";
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Section title="Welcome links for businesses we already serve" sub="The owner opens their Growth account in one click, then chooses a password; Reviews QR is free for a year if the gift is on. A link works once, for 14 days. Clinics get the same from their own portal.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <form onSubmit={make} className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="w-b">Business name</Label><Input id="w-b" className="mt-1" required maxLength={80} value={f.businessName} onChange={set("businessName")} /></div>
              <div>
                <Label>Kind</Label>
                <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KINDS).filter(([k]) => k !== "startup").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="w-c">City</Label><Input id="w-c" className="mt-1" maxLength={60} value={f.city} onChange={set("city")} /></div>
              <div><Label htmlFor="w-n">Owner's name</Label><Input id="w-n" className="mt-1" required maxLength={80} value={f.ownerName} onChange={set("ownerName")} /></div>
              <div><Label htmlFor="w-e">Owner's email</Label><Input id="w-e" className="mt-1" type="email" required value={f.ownerEmail} onChange={set("ownerEmail")} /></div>
              <div><Label htmlFor="w-p">Owner's WhatsApp</Label><Input id="w-p" className="mt-1" inputMode="tel" value={f.ownerPhone} onChange={set("ownerPhone")} /></div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={f.gift} onChange={(e) => setF({ ...f, gift: e.target.checked })} />
                Gift: Reviews QR free for 12 months
              </label>
              <div className="sm:col-span-2"><Button type="submit" disabled={busy}>Make the link</Button></div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {link && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold text-success">Link ready for {link.name}</p>
                <p className="break-all rounded bg-background px-3 py-2 font-mono text-xs">{link.url}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(link.url).then(() => toast.success("Copied."))}>
                    <Copy /> Copy
                  </Button>
                  {link.phone && (
                    <Button size="sm" onClick={() => window.open(wa, "_blank", "noopener")}>
                      <MessageCircle /> Send on WhatsApp
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0">
              <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">Recent links</p>
              {!list ? (
                <div className="p-4"><Skeleton className="h-6 w-full" /></div>
              ) : list.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((w, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{w.business}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{w.source === "clinic" ? "from the clinic portal" : `by ${w.by}`}</span>
                      </span>
                      <Badge variant={w.usedAt ? "success" : new Date(w.expiresAt) < new Date() ? "outline" : "warning"}>
                        {w.usedAt ? "Opened" : new Date(w.expiresAt) < new Date() ? "Expired" : "Waiting"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function Requests({ onMake }: { onMake: (id: string, name: string) => void }) {
  const [list, setList] = useState<PlanRequest[] | null>(null);
  const load = () => apiFetch<{ requests: PlanRequest[] }>("/growth/requests").then((r) => setList(r.requests), () => setList([]));
  useEffect(() => {
    load();
  }, []);
  if (!list || list.length === 0) return null;
  return (
    <Section title="Asked for a custom plan" sub="From the Custom plan box on Growth's Plans page.">
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{r.business}</span>
                  <span className="block text-sm">{r.note}</span>
                  <span className="text-xs text-muted-foreground">{r.by} · {date(r.at)}</span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onMake(r.businessId, r.business)}>Make their plan</Button>
                  <Button size="sm" variant="ghost" onClick={() => apiFetch(`/growth/requests/${r.id}/done`, { method: "POST" }).then(load)}>Done</Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Section>
  );
}
