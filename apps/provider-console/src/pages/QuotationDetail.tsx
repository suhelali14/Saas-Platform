/**
 * One quotation: editor when DRAFT, read-only with actions once SENT.
 *
 * The page is scoped to the thing on the paper: who it's to, what the
 * lines are, what the totals come to, what the T&C say. The right rail
 * carries the actions -- Send (locks + emails), Resend reminder, Accept,
 * Reject, Generate agreement -- and the activity log the owner reads
 * each morning so the morning view shows "when did we last talk".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Download,
  Mail,
  CheckCircle2,
  XCircle,
  FileSignature,
  Trash2,
  Save,
  Send,
  Plus,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { money, PLAN_LABEL, type PlanTier } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LineCategory =
  | "SOFTWARE"
  | "IMPLEMENTATION"
  | "TRAINING"
  | "CUSTOMIZATION"
  | "DATA_MIGRATION"
  | "SUPPORT"
  | "HARDWARE"
  | "OTHER";

type Stage =
  | "NEW_LEAD"
  | "QUALIFIED"
  | "QUOTE_SENT"
  | "FOLLOW_UP"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

type Status = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

type ActivityKind =
  | "CALL"
  | "EMAIL_SENT"
  | "EMAIL_RECEIVED"
  | "MEETING"
  | "WHATSAPP"
  | "SITE_VISIT"
  | "NOTE";

interface LineItem {
  id?: string;
  category: LineCategory;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal?: string;
  sortOrder?: number;
  sac?: string | null;
}

interface Activity {
  id: string;
  kind: ActivityKind;
  subject: string;
  body: string | null;
  outcome: string | null;
  actor: string;
  at: string;
  isScheduled: boolean;
  completedAt: string | null;
}

interface Quotation {
  id: string;
  accountId: string | null;
  number: string | null;
  status: Status;
  stage: Stage;
  version: number;
  title: string;
  planTier: PlanTier;
  clientName: string;
  clientAddress: string | null;
  clientGSTIN: string | null;
  clientState: string | null;
  clientContact: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  providerName: string;
  providerAddress: string | null;
  providerGSTIN: string | null;
  providerState: string | null;
  validUntil: string | null;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  cgst: string;
  sgst: string;
  igst: string;
  total: string;
  currency: string;
  scope: string | null;
  exclusions: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  internalNotes: string | null;
  summary: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  lineItems: LineItem[];
  activities: Activity[];
  agreements: { id: string; number: string | null; status: string; createdAt: string }[];
}

interface Template {
  id: string;
  label: string;
  summary: string;
  planTier: PlanTier;
  lines: Omit<LineItem, "id" | "lineTotal">[];
  scope: string;
  exclusions: string;
  paymentTerms: string;
  deliveryTerms: string;
}

const CATEGORY_LABEL: Record<LineCategory, string> = {
  SOFTWARE: "Software",
  IMPLEMENTATION: "Implementation",
  TRAINING: "Training",
  CUSTOMIZATION: "Customization",
  DATA_MIGRATION: "Data migration",
  SUPPORT: "Support",
  HARDWARE: "Hardware",
  OTHER: "Other",
};

const STAGE_LABEL: Record<Stage, string> = {
  NEW_LEAD: "New lead",
  QUALIFIED: "Qualified",
  QUOTE_SENT: "Quote sent",
  FOLLOW_UP: "Follow-up",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
};

const KIND_LABEL: Record<ActivityKind, string> = {
  CALL: "Call",
  EMAIL_SENT: "Email sent",
  EMAIL_RECEIVED: "Email received",
  MEETING: "Meeting",
  WHATSAPP: "WhatsApp",
  SITE_VISIT: "Site visit",
  NOTE: "Note",
};

const KIND_ICON: Record<ActivityKind, typeof Phone> = {
  CALL: Phone,
  EMAIL_SENT: Mail,
  EMAIL_RECEIVED: Mail,
  MEETING: Calendar,
  WHATSAPP: MessageSquare,
  SITE_VISIT: Calendar,
  NOTE: FileSignature,
};

function emptyQuotation(providerName: string): Quotation {
  return {
    id: "new",
    accountId: null,
    number: null,
    status: "DRAFT",
    stage: "NEW_LEAD",
    version: 1,
    title: "",
    planTier: "BASIC",
    clientName: "",
    clientAddress: null,
    clientGSTIN: null,
    clientState: null,
    clientContact: null,
    clientEmail: null,
    clientPhone: null,
    providerName,
    providerAddress: null,
    providerGSTIN: null,
    providerState: null,
    validUntil: null,
    subtotal: "0",
    discountAmount: "0",
    taxableAmount: "0",
    cgst: "0",
    sgst: "0",
    igst: "0",
    total: "0",
    currency: "INR",
    scope: null,
    exclusions: null,
    paymentTerms: null,
    deliveryTerms: null,
    internalNotes: null,
    summary: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    lineItems: [],
    activities: [],
    agreements: [],
  };
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function QuotationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === "new";

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityDraft, setActivityDraft] = useState<{ kind: ActivityKind; subject: string; outcome: string; isScheduled: boolean; at: string }>({
    kind: "NOTE",
    subject: "",
    outcome: "",
    isScheduled: false,
    at: "",
  });

  useEffect(() => {
    apiFetch<{ templates: Template[] }>("/quotations/templates")
      .then((r) => setTemplates(r.templates))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setQuote(emptyQuotation("Nayaversse"));
      return;
    }
    apiFetch<{ quotation: Quotation }>(`/quotations/${id}`)
      .then((r) => setQuote(r.quotation))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load quotation."));
  }, [id, isNew]);

  // ── Compute line totals locally while editing a draft, so the right
  //    rail reflects the current line items before a save round-trip.
  const totals = useMemo(() => {
    if (!quote) return null;
    const lines = quote.lineItems.map((l) => {
      const gross = l.quantity * l.unitPrice;
      return Math.max(0, gross - l.discount);
    });
    const subtotal = lines.reduce((a, b) => a + b, 0);
    const discountAmount = quote.lineItems.reduce((a, l) => a + l.discount, 0);
    const taxable = Math.max(0, subtotal - discountAmount);
    const intrastate =
      quote.providerState &&
      quote.clientState &&
      quote.providerState.toLowerCase() === quote.clientState.toLowerCase();
    const gst = taxable * 0.18;
    const half = gst / 2;
    return {
      subtotal,
      discountAmount,
      taxable,
      cgst: intrastate ? half : 0,
      sgst: intrastate ? half : 0,
      igst: intrastate ? 0 : gst,
      total: taxable + gst,
      lineTotals: lines,
    };
  }, [quote]);

  const applyTemplate = useCallback(
    (tid: string) => {
      const t = templates.find((x) => x.id === tid);
      if (!t || !quote) return;
      setQuote({
        ...quote,
        planTier: t.planTier,
        scope: t.scope,
        exclusions: t.exclusions,
        paymentTerms: t.paymentTerms,
        deliveryTerms: t.deliveryTerms,
        summary: t.summary,
        lineItems: t.lines.map((l, i) => ({ ...l, sortOrder: i })),
      });
    },
    [templates, quote],
  );

  const save = useCallback(async () => {
    if (!quote) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        accountId: quote.accountId ?? null,
        title: quote.title,
        planTier: quote.planTier,
        clientName: quote.clientName,
        clientAddress: quote.clientAddress,
        clientGSTIN: quote.clientGSTIN,
        clientState: quote.clientState,
        clientContact: quote.clientContact,
        clientEmail: quote.clientEmail || null,
        clientPhone: quote.clientPhone,
        providerName: quote.providerName,
        providerAddress: quote.providerAddress,
        providerGSTIN: quote.providerGSTIN,
        providerState: quote.providerState,
        validUntil: quote.validUntil,
        scope: quote.scope,
        exclusions: quote.exclusions,
        paymentTerms: quote.paymentTerms,
        deliveryTerms: quote.deliveryTerms,
        internalNotes: quote.internalNotes,
        summary: quote.summary,
        stage: quote.stage,
        nextFollowUpAt: quote.nextFollowUpAt,
        topLevelDiscount: 0,
        lineItems: quote.lineItems.map((l, i) => ({
          category: l.category,
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          sortOrder: i,
          sac: l.sac ?? undefined,
        })),
      };
      if (isNew) {
        const r = await apiFetch<{ quotation: Quotation }>("/quotations", {
          method: "POST",
          data: body,
        });
        toast.success("Quotation created.");
        navigate(`/quotations/${r.quotation.id}`);
      } else {
        const r = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`, {
          method: "PATCH",
          data: body,
        });
        setQuote(r.quotation);
        toast.success("Saved.");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Save failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [quote, isNew, navigate, toast]);

  const sendNow = useCallback(async () => {
    if (!quote || !quote.clientEmail) {
      toast.error("Add a client email before sending.");
      return;
    }
    setSending(true);
    try {
      const r = await apiFetch<{ number: string; emailed: boolean }>(`/quotations/${quote.id}/send`, {
        method: "POST",
        data: { to: quote.clientEmail },
      });
      toast.success(r.emailed ? `Sent as ${r.number}` : `Numbered ${r.number}; email not sent (check SMTP).`);
      const refreshed = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`);
      setQuote(refreshed.quotation);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }, [quote, toast]);

  const resend = useCallback(async () => {
    if (!quote) return;
    try {
      await apiFetch(`/quotations/${quote.id}/resend`, { method: "POST", data: {} });
      toast.success("Reminder sent.");
      const refreshed = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`);
      setQuote(refreshed.quotation);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reminder failed.");
    }
  }, [quote, toast]);

  const accept = useCallback(async () => {
    if (!quote) return;
    const who = window.prompt("Who at the client accepted? (name / role / email reference)");
    if (!who) return;
    await apiFetch(`/quotations/${quote.id}/accept`, { method: "POST", data: { acceptedBy: who } });
    const refreshed = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`);
    setQuote(refreshed.quotation);
    toast.success("Marked accepted.");
  }, [quote, toast]);

  const reject = useCallback(async () => {
    if (!quote) return;
    const reason = window.prompt("Reason (optional):") ?? "";
    await apiFetch(`/quotations/${quote.id}/reject`, { method: "POST", data: { reason } });
    const refreshed = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`);
    setQuote(refreshed.quotation);
  }, [quote]);

  const generateAgreement = useCallback(async () => {
    if (!quote) return;
    if (!quote.accountId) {
      toast.error("Link this quote to a ClinicAccount first.");
      return;
    }
    const effective = window.prompt("Agreement effective date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!effective) return;
    const r = await apiFetch<{ agreement: { id: string } }>(`/quotations/${quote.id}/agreement`, {
      method: "POST",
      data: { effectiveFrom: `${effective}T00:00:00.000Z` },
    });
    toast.success("Agreement drafted.");
    navigate(`/agreements/${r.agreement.id}`);
  }, [quote, navigate, toast]);

  const addActivity = useCallback(async () => {
    if (!quote || !activityDraft.subject) return;
    const payload: Record<string, unknown> = {
      kind: activityDraft.kind,
      subject: activityDraft.subject,
      outcome: activityDraft.outcome || undefined,
      isScheduled: activityDraft.isScheduled,
    };
    if (activityDraft.at) payload.at = `${activityDraft.at}T09:00:00.000Z`;
    await apiFetch(`/quotations/${quote.id}/activities`, { method: "POST", data: payload });
    setActivityDraft({ kind: "NOTE", subject: "", outcome: "", isScheduled: false, at: "" });
    const refreshed = await apiFetch<{ quotation: Quotation }>(`/quotations/${quote.id}`);
    setQuote(refreshed.quotation);
  }, [quote, activityDraft]);

  if (error && !quote) {
    return (
      <div className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const editable = quote.status === "DRAFT";

  const setLine = (i: number, patch: Partial<LineItem>) => {
    setQuote({
      ...quote,
      lineItems: quote.lineItems.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    });
  };
  const removeLine = (i: number) => {
    setQuote({ ...quote, lineItems: quote.lineItems.filter((_, idx) => idx !== i) });
  };
  const addLine = () => {
    setQuote({
      ...quote,
      lineItems: [
        ...quote.lineItems,
        { category: "OTHER", description: "", unit: "one-time", quantity: 1, unitPrice: 0, discount: 0 },
      ],
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ─────────── Main column ─────────── */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/quotations" className="hover:underline">Pipeline</Link>
              <span>/</span>
              <span>{quote.number ?? "Draft"}</span>
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
              {quote.clientName || "New quotation"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={quote.status === "ACCEPTED" ? "success" : "default"}>{quote.status}</Badge>
              <span>·</span>
              <span>{STAGE_LABEL[quote.stage]}</span>
              {quote.version > 1 && <span>· v{quote.version}</span>}
            </div>
          </div>
        </div>

        {/* Templates row (DRAFT only). */}
        {editable && templates.length > 0 && (
          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <span className="text-xs text-muted-foreground">Start from:</span>
              {templates.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ─────────── Who it's to / from ─────────── */}
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</h2>
              <Field label="Title" value={quote.title} onChange={(v) => setQuote({ ...quote, title: v })} disabled={!editable} />
              <Field label="Client name" value={quote.clientName} onChange={(v) => setQuote({ ...quote, clientName: v })} disabled={!editable} />
              <Field label="Contact person" value={quote.clientContact ?? ""} onChange={(v) => setQuote({ ...quote, clientContact: v })} disabled={!editable} />
              <Field label="Email" type="email" value={quote.clientEmail ?? ""} onChange={(v) => setQuote({ ...quote, clientEmail: v })} disabled={!editable} />
              <Field label="Phone" value={quote.clientPhone ?? ""} onChange={(v) => setQuote({ ...quote, clientPhone: v })} disabled={!editable} />
              <Field label="GSTIN" value={quote.clientGSTIN ?? ""} onChange={(v) => setQuote({ ...quote, clientGSTIN: v })} disabled={!editable} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={quote.clientState ?? ""} onChange={(v) => setQuote({ ...quote, clientState: v })} disabled={!editable} />
                <Field label="Valid until" type="date" value={quote.validUntil?.slice(0, 10) ?? ""} onChange={(v) => setQuote({ ...quote, validUntil: v ? `${v}T00:00:00.000Z` : null })} disabled={!editable} />
              </div>
              <AreaField label="Address" value={quote.clientAddress ?? ""} onChange={(v) => setQuote({ ...quote, clientAddress: v })} disabled={!editable} />
            </div>
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</h2>
              <Field label="Provider name" value={quote.providerName} onChange={(v) => setQuote({ ...quote, providerName: v })} disabled={!editable} />
              <Field label="GSTIN" value={quote.providerGSTIN ?? ""} onChange={(v) => setQuote({ ...quote, providerGSTIN: v })} disabled={!editable} />
              <Field label="State" value={quote.providerState ?? ""} onChange={(v) => setQuote({ ...quote, providerState: v })} disabled={!editable} />
              <AreaField label="Address" value={quote.providerAddress ?? ""} onChange={(v) => setQuote({ ...quote, providerAddress: v })} disabled={!editable} />
              <div>
                <Label className="text-xs">Plan tier</Label>
                <Select
                  value={quote.planTier}
                  onValueChange={(v) => setQuote({ ...quote, planTier: v as PlanTier })}
                  disabled={!editable}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as PlanTier[]).map((p) => (
                      <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AreaField label="Cover summary (page 1 of the PDF)" value={quote.summary ?? ""} onChange={(v) => setQuote({ ...quote, summary: v })} disabled={!editable} />
            </div>
          </CardContent>
        </Card>

        {/* ─────────── Line items ─────────── */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line items</h2>
              {editable && (
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 size-3.5" />
                  Add
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {quote.lineItems.map((l, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-12">
                  <div className="md:col-span-2">
                    <Label className="text-[11px] text-muted-foreground">Category</Label>
                    <Select
                      value={l.category}
                      onValueChange={(v) => setLine(i, { category: v as LineCategory })}
                      disabled={!editable}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CATEGORY_LABEL) as LineCategory[]).map((k) => (
                          <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-[11px] text-muted-foreground">Description</Label>
                    <Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} disabled={!editable} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px] text-muted-foreground">Unit</Label>
                    <Input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} disabled={!editable} />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: Number(e.target.value || 0) })}
                      disabled={!editable}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px] text-muted-foreground">Unit price</Label>
                    <Input
                      type="number"
                      value={l.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: Number(e.target.value || 0) })}
                      disabled={!editable}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Disc</Label>
                    <Input
                      type="number"
                      value={l.discount}
                      onChange={(e) => setLine(i, { discount: Number(e.target.value || 0) })}
                      disabled={!editable}
                    />
                  </div>
                  <div className="col-span-full flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular">
                      Line total: {money((totals?.lineTotals[i] ?? 0).toFixed(2))}
                    </span>
                    {editable && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {quote.lineItems.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-6 text-center text-sm italic text-muted-foreground">
                  No line items yet. Pick a template above, or add a line.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─────────── Prose sections ─────────── */}
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <AreaField tall label="Scope of work" value={quote.scope ?? ""} onChange={(v) => setQuote({ ...quote, scope: v })} disabled={!editable} />
            <AreaField tall label="Exclusions" value={quote.exclusions ?? ""} onChange={(v) => setQuote({ ...quote, exclusions: v })} disabled={!editable} />
            <AreaField label="Payment terms" value={quote.paymentTerms ?? ""} onChange={(v) => setQuote({ ...quote, paymentTerms: v })} disabled={!editable} />
            <AreaField label="Delivery terms" value={quote.deliveryTerms ?? ""} onChange={(v) => setQuote({ ...quote, deliveryTerms: v })} disabled={!editable} />
            <AreaField
              className="md:col-span-2"
              label="Internal notes (never on the PDF)"
              value={quote.internalNotes ?? ""}
              onChange={(v) => setQuote({ ...quote, internalNotes: v })}
              disabled={!editable}
            />
          </CardContent>
        </Card>

        {/* ─────────── Activity log ─────────── */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Activity</h2>
            <div className="space-y-3">
              {!isNew && (
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[120px_minmax(0,1fr)_120px_auto]">
                  <Select
                    value={activityDraft.kind}
                    onValueChange={(v) => setActivityDraft({ ...activityDraft, kind: v as ActivityKind })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Subject (e.g. 'Called, asked for revised price on training')"
                    value={activityDraft.subject}
                    onChange={(e) => setActivityDraft({ ...activityDraft, subject: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={activityDraft.at}
                    onChange={(e) => setActivityDraft({ ...activityDraft, at: e.target.value })}
                    title="Future date = scheduled follow-up"
                  />
                  <Button type="button" size="sm" onClick={addActivity} disabled={!activityDraft.subject}>
                    Log
                  </Button>
                  <label className="col-span-full flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={activityDraft.isScheduled}
                      onChange={(e) => setActivityDraft({ ...activityDraft, isScheduled: e.target.checked })}
                    />
                    This is a scheduled follow-up (sets the next follow-up date)
                  </label>
                </div>
              )}
              {quote.activities.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">No activity logged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {quote.activities.map((a) => {
                    const Icon = KIND_ICON[a.kind];
                    return (
                      <li key={a.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{a.subject}</p>
                            {a.isScheduled && !a.completedAt && <Badge variant="warning" className="text-[10px]">scheduled</Badge>}
                          </div>
                          {a.outcome && <p className="mt-0.5 text-xs text-muted-foreground">{a.outcome}</p>}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {KIND_LABEL[a.kind]} · {a.actor} · {date(a.at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─────────── Right rail: totals + actions ─────────── */}
      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Totals</h2>
            <Row k="Subtotal" v={money((totals?.subtotal ?? Number(quote.subtotal)).toFixed(2))} />
            {(totals?.discountAmount ?? 0) > 0 && <Row k="Discount" v={`- ${money((totals?.discountAmount ?? 0).toFixed(2))}`} />}
            <Row k="Taxable" v={money((totals?.taxable ?? Number(quote.taxableAmount)).toFixed(2))} />
            {(totals?.cgst ?? 0) > 0 && <Row k="CGST 9%" v={money((totals?.cgst ?? 0).toFixed(2))} />}
            {(totals?.sgst ?? 0) > 0 && <Row k="SGST 9%" v={money((totals?.sgst ?? 0).toFixed(2))} />}
            {(totals?.igst ?? 0) > 0 && <Row k="IGST 18%" v={money((totals?.igst ?? 0).toFixed(2))} />}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Grand total</span>
              <span className="tabular">{money((totals?.total ?? Number(quote.total)).toFixed(2))}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</h2>
            {editable && (
              <>
                <Button type="button" className="w-full justify-start" onClick={save} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {isNew ? "Create draft" : "Save draft"}
                </Button>
                {!isNew && (
                  <Button type="button" variant="default" className="w-full justify-start" onClick={sendNow} disabled={sending || !quote.clientEmail}>
                    <Send className="mr-2 size-4" />
                    {sending ? "Sending…" : "Lock & email quote"}
                  </Button>
                )}
              </>
            )}
            {quote.status === "SENT" && (
              <>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={resend}>
                  <Mail className="mr-2 size-4" />
                  Send reminder
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={accept}>
                  <CheckCircle2 className="mr-2 size-4" />
                  Mark accepted
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={reject}>
                  <XCircle className="mr-2 size-4" />
                  Mark rejected
                </Button>
              </>
            )}
            {quote.status === "ACCEPTED" && quote.agreements.length === 0 && (
              <Button type="button" variant="default" className="w-full justify-start" onClick={generateAgreement}>
                <FileSignature className="mr-2 size-4" />
                Generate agreement
              </Button>
            )}
            {quote.agreements.length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Agreements</p>
                {quote.agreements.map((a) => (
                  <Link key={a.id} to={`/agreements/${a.id}`} className="block rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent">
                    {a.number ?? "Draft"} <span className="text-muted-foreground">· {a.status}</span>
                  </Link>
                ))}
              </div>
            )}
            {!isNew && (
              <a
                href={`${import.meta.env.VITE_API_URL || "http://localhost:4200/api/provider"}/quotations/${quote.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Download className="mr-2 size-4" />
                Download PDF
              </a>
            )}
          </CardContent>
        </Card>

        {!isNew && (
          <Card>
            <CardContent className="space-y-1 p-5 text-xs text-muted-foreground">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider">Timeline</h2>
              {quote.sentAt && <p><Clock className="inline size-3" /> Sent {date(quote.sentAt)}</p>}
              {quote.lastContactedAt && <p><Clock className="inline size-3" /> Last touch {date(quote.lastContactedAt)}</p>}
              {quote.nextFollowUpAt && <p><Clock className="inline size-3" /> Next follow-up {date(quote.nextFollowUpAt)}</p>}
              {quote.acceptedAt && <p><Clock className="inline size-3" /> Accepted {date(quote.acceptedAt)}</p>}
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
  disabled,
  tall,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  tall?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={tall ? 5 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}
