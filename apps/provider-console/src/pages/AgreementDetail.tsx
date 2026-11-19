/**
 * The signed service agreement, and its lifecycle: DRAFT -> AWAITING_SIGN
 * (provider signed, waiting on the client) -> ACTIVE (both signed) ->
 * TERMINATED | EXPIRED.
 *
 * The clauses are rendered from Agreement.clauses -- the same source the
 * PDF reads -- so an edit to the clause builder only shows up on drafts
 * generated AFTER the edit, never on a draft in flight.
 */
import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Shield, CheckCircle2, XCircle, FileSignature } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { money } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Clause {
  heading: string;
  paragraphs: string[];
}

interface Agreement {
  id: string;
  accountId: string;
  quotationId: string | null;
  number: string | null;
  status: "DRAFT" | "AWAITING_SIGN" | "ACTIVE" | "TERMINATED" | "EXPIRED";
  title: string;
  clauses: Clause[];
  effectiveFrom: string | null;
  termMonths: number;
  noticeDays: number;
  autoRenew: boolean;
  clientName: string;
  clientAddress: string | null;
  clientGSTIN: string | null;
  providerName: string;
  providerAddress: string | null;
  providerGSTIN: string | null;
  setupFee: string | null;
  yearlyFee: string | null;
  monthlyFee: string | null;
  currency: string;
  providerSignedBy: string | null;
  providerSignedAt: string | null;
  clientSignedByName: string | null;
  clientSignedByRole: string | null;
  clientSignedAt: string | null;
  issuedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  account: { id: string; slug: string; name: string };
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [a, setA] = useState<Agreement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await apiFetch<{ agreement: Agreement }>(`/agreements/${id}`);
      setA(r.agreement);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load agreement.");
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const issue = useCallback(async () => {
    if (!a) return;
    if (!window.confirm("Issue this agreement and record the provider signature? The number becomes permanent.")) return;
    await apiFetch(`/agreements/${a.id}/issue`, { method: "POST", data: {} });
    toast.success("Issued.");
    refresh();
  }, [a, refresh, toast]);

  const countersign = useCallback(async () => {
    if (!a) return;
    const name = window.prompt("Client signer name:");
    if (!name) return;
    const role = window.prompt("Client signer role (e.g. 'Owner', 'Director'):") ?? "";
    await apiFetch(`/agreements/${a.id}/countersign`, {
      method: "POST",
      data: { signerName: name, signerRole: role },
    });
    toast.success("Countersigned. Agreement is ACTIVE.");
    refresh();
  }, [a, refresh, toast]);

  const terminate = useCallback(async () => {
    if (!a) return;
    const reason = window.prompt("Termination reason:");
    if (!reason) return;
    await apiFetch(`/agreements/${a.id}/terminate`, { method: "POST", data: { reason } });
    toast.success("Terminated.");
    refresh();
  }, [a, refresh, toast]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
    );
  }
  if (!a) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/quotations" className="hover:underline">Pipeline</Link>
            <span>/</span>
            <Link to={`/clinics/${a.accountId}`} className="hover:underline">{a.account?.name ?? "Clinic"}</Link>
            <span>/</span>
            <span>{a.number ?? "Draft agreement"}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Service Agreement — {a.clientName}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={a.status === "ACTIVE" ? "success" : "default"}>{a.status}</Badge>
            {a.effectiveFrom && <span>· Effective {date(a.effectiveFrom)}</span>}
            <span>· {a.termMonths}-month term{a.autoRenew ? ", auto-renewing" : ""}</span>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-6 p-5">
            {a.clauses.map((c) => (
              <section key={c.heading}>
                <h2 className="text-base font-semibold">{c.heading}</h2>
                <div className="mt-2 space-y-3">
                  {c.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fees (ex. GST)</h2>
            {a.setupFee && <Row k="One-time" v={money(a.setupFee)} />}
            {a.yearlyFee && <Row k="Annual" v={money(a.yearlyFee)} />}
            {a.monthlyFee && <Row k="Monthly" v={money(a.monthlyFee)} />}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Signatures</h2>
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Provider</p>
              <p className="font-medium">{a.providerSignedBy ?? a.providerName}</p>
              <p className="text-xs text-muted-foreground">{date(a.providerSignedAt)}</p>
            </div>
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Client</p>
              <p className="font-medium">{a.clientSignedByName ?? a.clientName}</p>
              {a.clientSignedByRole && <p className="text-xs text-muted-foreground">{a.clientSignedByRole}</p>}
              <p className="text-xs text-muted-foreground">{date(a.clientSignedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</h2>
            {a.status === "DRAFT" && (
              <Button type="button" className="w-full justify-start" onClick={issue}>
                <FileSignature className="mr-2 size-4" />
                Issue & provider-sign
              </Button>
            )}
            {a.status === "AWAITING_SIGN" && (
              <Button type="button" className="w-full justify-start" onClick={countersign}>
                <CheckCircle2 className="mr-2 size-4" />
                Record client signature
              </Button>
            )}
            {(a.status === "ACTIVE" || a.status === "AWAITING_SIGN") && (
              <Button type="button" variant="outline" className="w-full justify-start" onClick={terminate}>
                <XCircle className="mr-2 size-4" />
                Terminate
              </Button>
            )}
            <a
              href={`${import.meta.env.VITE_API_URL || "http://localhost:4200/api/provider"}/agreements/${a.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Download className="mr-2 size-4" />
              Download PDF
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 p-5 text-xs text-muted-foreground">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider">DPDP / NABH</h2>
            <p className="flex items-start gap-2">
              <Shield className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Clause 5 names the Customer as Data Fiduciary and Nayaversse as Data Processor under the DPDP Act 2023, with
                breach-notification, data-principal-request assistance and deletion-on-exit obligations aligned to the DPDP
                Rules 2025.
              </span>
            </p>
          </CardContent>
        </Card>
      </aside>
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
