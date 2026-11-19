/**
 * The sales pipeline the owner opens each morning.
 *
 * Shape is a seven-column board rather than a flat table: QUALIFIED,
 * QUOTE_SENT, FOLLOW_UP, NEGOTIATION, CLOSED_WON, CLOSED_LOST (NEW_LEAD
 * is folded in to the first column). The view is for a vendor with a
 * handful of deals at a time; a dense CRM-style table would be a lie
 * about the scale this product is at today, and would hide the one
 * number that matters: which deal needs a call now.
 *
 * Every card shows overdue follow-ups in red, because missing those is
 * the main failure a one-person company has to guard against.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, AlertTriangle, FileText } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { money } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Stage =
  | "NEW_LEAD"
  | "QUALIFIED"
  | "QUOTE_SENT"
  | "FOLLOW_UP"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

interface PipelineQuote {
  id: string;
  number: string | null;
  title: string;
  stage: Stage;
  status: string;
  clientName: string;
  total: string;
  currency: string;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
}

interface Pipeline {
  quotations: PipelineQuote[];
}

const STAGE_LABEL: Record<Stage, string> = {
  NEW_LEAD: "New lead",
  QUALIFIED: "Qualified",
  QUOTE_SENT: "Quote sent",
  FOLLOW_UP: "Follow-up",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Won",
  CLOSED_LOST: "Lost",
};

const PIPELINE_STAGES: Stage[] = [
  "NEW_LEAD",
  "QUALIFIED",
  "QUOTE_SENT",
  "FOLLOW_UP",
  "NEGOTIATION",
];

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

function QuoteCard({ q }: { q: PipelineQuote }) {
  return (
    <Link
      to={`/quotations/${q.id}`}
      className="group block rounded-md border border-border bg-background/60 p-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium group-hover:underline">{q.clientName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{q.title}</p>
        </div>
        {q.overdue && (
          <span title="Follow-up overdue" className="shrink-0 text-destructive">
            <AlertTriangle className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular">{money(Number(q.total))}</span>
        <span className={q.overdue ? "text-destructive" : undefined}>
          {q.nextFollowUpAt ? `Chase ${date(q.nextFollowUpAt)}` : q.number ?? "Draft"}
        </span>
      </div>
    </Link>
  );
}

export function Quotations() {
  const [data, setData] = useState<Pipeline | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Pipeline>("/quotations/pipeline")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the pipeline."));
  }, []);

  const byStage = useMemo(() => {
    const m = new Map<Stage, PipelineQuote[]>();
    for (const s of PIPELINE_STAGES) m.set(s, []);
    for (const q of data?.quotations ?? []) {
      // CLOSED_WON / CLOSED_LOST are not shown on the board; they appear
      // in the won/lost list below so the main columns stay a work view.
      const target = PIPELINE_STAGES.includes(q.stage) ? q.stage : null;
      if (target) m.get(target)!.push(q);
    }
    return m;
  }, [data]);

  const closed = useMemo(
    () => (data?.quotations ?? []).filter((q) => q.stage === "CLOSED_WON" || q.stage === "CLOSED_LOST"),
    [data],
  );
  const openValue = useMemo(
    () =>
      (data?.quotations ?? [])
        .filter((q) => !["CLOSED_LOST", "CLOSED_WON"].includes(q.stage))
        .reduce((sum, q) => sum + Number(q.total), 0),
    [data],
  );
  const overdueCount = useMemo(
    () => (data?.quotations ?? []).filter((q) => q.overdue).length,
    [data],
  );

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {money(openValue)} across {data.quotations.filter((q) => q.stage !== "CLOSED_LOST" && q.stage !== "CLOSED_WON").length} open deal(s)
            {overdueCount > 0 ? ` · ${overdueCount} overdue follow-up(s)` : ""}
          </p>
        </div>
        <Button asChild>
          <Link to="/quotations/new">
            <Plus className="mr-1 size-4" />
            New quotation
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {PIPELINE_STAGES.map((stage) => {
          const rows = byStage.get(stage) ?? [];
          return (
            <Card key={stage} className="flex flex-col">
              <CardContent className="flex min-h-[320px] flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {STAGE_LABEL[stage]}
                  </h2>
                  <Badge variant="outline" className="text-[10px]">
                    {rows.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {rows.length === 0 && (
                    <p className="text-[11px] italic text-muted-foreground/70">—</p>
                  )}
                  {rows.map((q) => (
                    <QuoteCard key={q.id} q={q} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {closed.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" />
              Closed recently
            </h2>
            <ul className="divide-y divide-border">
              {closed.slice(0, 10).map((q) => (
                <li key={q.id} className="flex items-center gap-3 py-2.5">
                  <Badge variant={q.stage === "CLOSED_WON" ? "default" : "outline"}>
                    {q.stage === "CLOSED_WON" ? "Won" : "Lost"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <Link to={`/quotations/${q.id}`} className="text-sm font-medium hover:underline">
                      {q.clientName}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">{q.title}</p>
                  </div>
                  <span className="text-sm tabular">{money(Number(q.total))}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
