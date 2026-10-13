import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneCall, Copy, Check, Clock } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';
import { CATEGORY_BADGES } from '../lib/categories';
import { useToast } from './Toast';

/**
 * Who is overdue to come back.
 *
 * Two questions a front desk treats as one list of people to ring:
 *
 * - A follow-up the doctor asked for, whose date has passed with no
 *   visit since. Continuity of care, and currently invisible unless the
 *   doctor happened to tick the reminder box for themselves.
 * - A patient with a chronic condition not seen in months. Nothing in
 *   the system notices this at all today, and a diabetic who stopped
 *   coming is the clearest case of somebody the clinic should call.
 *
 * ── Deliberately a list, not a campaign ──────────────────────────────
 *
 * This deployment has no SMS or WhatsApp integration. Producing a list
 * somebody works through is honest; a button that claimed to have sent
 * reminders would not be, and the clinic would find out when nobody
 * arrived. What it does instead is make the list actually workable: a
 * tap-to-call link on a phone, and the numbers copyable in one go for
 * whoever is doing the ringing.
 *
 * Only chronic conditions go in the quiet list. Somebody who came once
 * with a cold and never returned is not overdue for anything, and
 * including them would turn a clinical list into a marketing one.
 */

type RecallRow = {
  patientId: string;
  uhid: string;
  name: string;
  phone: string | null;
  category: string;
  reason: 'follow-up' | 'chronic-quiet';
  dueOn: string | null;
  detail: string | null;
  lastSeen: string | null;
};

type Recall = {
  quietMonths: number;
  generatedAt: string;
  overdue: RecallRow[];
  quiet: RecallRow[];
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function RecallList() {
  const [data, setData] = useState<Recall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState('6');
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Recall>(`/patients-recall?months=${months}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the recall list.');
    }
  }, [months]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const all = [...data.overdue, ...data.quiet];
  const numbers = all.map((r) => r.phone).filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {all.length === 0
            ? 'Nobody is overdue. '
            : `${all.length} ${all.length === 1 ? 'person' : 'people'} to call. `}
          There is no SMS or WhatsApp set up on this deployment, so this is a list to work
          through rather than something that sends itself.
        </p>
        {numbers.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? <Check size={12} /> : <Copy size={12} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(numbers.join(', '));
                setCopied(true);
                toast.success(`${numbers.length} numbers copied.`);
                setTimeout(() => setCopied(false), 2500);
              } catch {
                // Clipboard access is refused in some browsers without a
                // secure context; the numbers are still on screen.
                toast.error('Could not copy — the numbers are listed below.');
              }
            }}
          >
            Copy {numbers.length} numbers
          </Button>
        )}
      </div>

      {/* ── Follow-ups the doctor asked for ──────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold">
          Follow-up date passed{data.overdue.length > 0 && ` · ${data.overdue.length}`}
        </h3>
        <p className="mt-0.5 mb-2 text-[11px] text-muted-foreground">
          The doctor asked them to come back and they have not been in since.
        </p>
        {data.overdue.length === 0 ? (
          <p className="rounded-lg border border-border/10 bg-foreground/[0.02] p-3 text-[11px] text-muted-foreground">
            Nobody has missed a follow-up.
          </p>
        ) : (
          <div className="divide-y divide-border/10 overflow-hidden rounded-lg border border-border/10">
            {data.overdue.map((r) => <Row key={`${r.patientId}-${r.dueOn}`} row={r} />)}
          </div>
        )}
      </section>

      {/* ── Chronic patients who have gone quiet ─────────────────────── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold">
              Chronic patients not seen recently{data.quiet.length > 0 && ` · ${data.quiet.length}`}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              On long-term treatment, and nobody has seen them in a while.
            </p>
          </div>
          <SegmentedControl
            label="How long counts as a while"
            value={months}
            onChange={setMonths}
            options={[
              { value: '3', label: '3 months' },
              { value: '6', label: '6 months' },
              { value: '12', label: '1 year' },
            ]}
          />
        </div>
        {data.quiet.length === 0 ? (
          <p className="mt-2 rounded-lg border border-border/10 bg-foreground/[0.02] p-3 text-[11px] text-muted-foreground">
            Every chronic patient has been seen within {data.quietMonths} months.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-border/10 overflow-hidden rounded-lg border border-border/10">
            {data.quiet.map((r) => <Row key={r.patientId} row={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ row }: { row: RecallRow }) {
  const since = daysSince(row.lastSeen);
  const overdueBy = row.dueOn ? daysSince(row.dueOn) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-foreground/[0.02] p-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-medium">
          <Link to={`/patients/${row.patientId}`} className="truncate hover:underline">
            {row.name}
          </Link>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{row.uhid}</span>
          {row.category !== 'GENERAL' && CATEGORY_BADGES[row.category] && (
            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]', CATEGORY_BADGES[row.category]!.color)}>
              {CATEGORY_BADGES[row.category]!.label}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {row.reason === 'follow-up' ? (
            <span className="flex items-center gap-1 text-warning">
              <Clock size={10} aria-hidden="true" />
              due {date(row.dueOn)}
              {overdueBy != null && overdueBy > 0 && ` · ${overdueBy} days late`}
            </span>
          ) : (
            <span>
              last seen {date(row.lastSeen)}
              {since != null && ` · ${Math.round(since / 30)} months ago`}
            </span>
          )}
          {row.detail && <span className="truncate">· {row.detail}</span>}
        </p>
      </div>

      {/* tel: rather than a copy button, because reception is usually
          holding the phone this list is being read on. */}
      {row.phone ? (
        <a
          href={`tel:${row.phone.replace(/\s/g, '')}`}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-foreground/10 px-2.5 py-1.5 text-[11px] hover:bg-foreground/20"
        >
          <PhoneCall size={11} aria-hidden="true" />
          {row.phone}
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground/60">no phone on record</span>
      )}
    </div>
  );
}
