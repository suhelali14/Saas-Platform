import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { type PlanTier, type PricingModel, PLAN_LABEL, PRICING_LABEL, money } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Overview {
  renewals: { id: string; name: string; plan: PlanTier; renewsAt: string | null; status: string; pricingModel: PricingModel; overdue: boolean }[];
  unpaid: { id: string; number: string | null; total: string; dueAt: string | null; overdue: boolean; account: { id: string; name: string } }[];
  owed: number;
  collectedThisMonth: number;
  supplierReady: boolean;
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * What needs chasing.
 *
 * Renewals in the next 30 days (and any already past), and every issued
 * invoice not yet paid, oldest due first. Collected money is counted from
 * invoices marked paid, never from invoices raised: an unpaid invoice is
 * not income.
 */
export function Billing() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Overview>("/billing/overview")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load billing."));
  }, []);

  if (error) return <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (!data) return <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(data.collectedThisMonth)} collected this month · {money(data.owed)} invoiced and not yet paid
          </p>
        </div>
      </div>

      {!data.supplierReady && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>Invoices can be drafted but not issued until PROVIDER_GSTIN is set on the console: a tax invoice has to carry your GSTIN. Set PROVIDER_LEGAL_NAME, PROVIDER_ADDRESS and PROVIDER_STATE_CODE at the same time.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Renewals due in the next 30 days</h2>
            {data.renewals.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.renewals.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/clinics/${r.id}`} className="text-sm font-medium hover:underline">{r.name}</Link>
                      <p className="text-[11px] text-muted-foreground">{PLAN_LABEL[r.plan]} · {PRICING_LABEL[r.pricingModel]}</p>
                    </div>
                    <span className={`text-sm tabular ${r.overdue ? "text-warning font-medium" : ""}`}>{date(r.renewsAt)}</span>
                    {r.overdue && <Badge variant="warning">past</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Unpaid invoices</h2>
            {data.unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.unpaid.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link to={`/invoices/${i.id}`} className="font-mono text-sm hover:underline">{i.number}</Link>
                      <p className="text-[11px] text-muted-foreground">
                        <Link to={`/clinics/${i.account.id}`} className="hover:underline">{i.account.name}</Link> · due {date(i.dueAt)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular">{money(i.total)}</span>
                    {i.overdue && <Badge variant="warning">overdue</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
