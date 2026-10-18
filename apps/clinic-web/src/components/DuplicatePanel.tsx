import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui';
import { useToast } from './Toast';

/**
 * Offers to combine two records that look like the same person.
 *
 * Shown on the patient, rather than as a list of all duplicates in the
 * clinic, because this is the moment somebody is looking at the record
 * and can actually tell: the patient is often standing there, and "is
 * this you from two years ago?" takes one question.
 *
 * ── Why this is a dialog and not a button ────────────────────────────
 *
 * The merge is irreversible and combines two people's medical histories
 * if it is wrong. So the confirmation does three things a plain
 * "Are you sure?" would not:
 *
 * - names what will actually move, counted from the record
 * - shows both records side by side, with the fields that disagree
 *   marked, so a mother and daughter are visible as different people
 * - says the word irreversible, because it is
 *
 * The matcher already refuses the obvious false positives — a shared
 * family phone with an unrelated name, a disagreeing date of birth, a
 * different recorded sex. What reaches this dialog is genuinely
 * ambiguous, which is exactly why a person decides it.
 */

type Candidate = {
  id: string;
  uhid: string;
  name: string;
  phone: string | null;
  dob: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  createdAt: string;
  visits: number;
  lastSeen: string | null;
  score: number;
  reasons: string[];
};

type Patient = {
  id: string; uhid: string; name: string; phone: string | null;
  dob?: string | null; age: number | null; gender: string | null; address: string | null;
};

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function DuplicatePanel({ patient, onMerged }: { patient: Patient; onMerged: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [confirming, setConfirming] = useState<Candidate | null>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ candidates: Candidate[] }>(`/patients/${patient.id}/duplicates`)
      .then((r) => { if (!cancelled) setCandidates(r.candidates); })
      .catch(() => {
        // A failed check must not put an error banner on a clinical
        // screen. The panel simply does not appear.
      });
    return () => { cancelled = true; };
  }, [patient.id]);

  if (candidates.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-ink-warning/30 bg-ink-warning/5 p-4">
      <div className="flex items-start gap-2.5">
        <Users size={15} className="mt-0.5 shrink-0 text-ink-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {candidates.length === 1
              ? 'Another record may be the same person'
              : `${candidates.length} other records may be the same person`}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            A split record means half this patient&rsquo;s history sits elsewhere, and whoever sees
            them next sees only half. If the patient is here, one question settles it.
          </p>

          <div className="mt-3 space-y-2">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/10 bg-background/40 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{c.uhid}</span>
                    {/* The score as words, not a number. "87% match" invites
                        a judgement about the number; the reasons invite a
                        judgement about the patient. */}
                    <span className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                      c.score >= 85 ? 'bg-ink-warning/20 text-ink-warning' : 'bg-foreground/10 text-muted-foreground',
                    )}>
                      {c.reasons.join(', ')}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.phone ?? 'no phone'} · {c.visits} visit{c.visits === 1 ? '' : 's'} ·{' '}
                    {c.lastSeen ? `last seen ${date(c.lastSeen)}` : 'never seen'} ·
                    registered {date(c.createdAt)}
                  </p>
                </div>
                <Link
                  to={`/patients/${c.id}`}
                  className="shrink-0 text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  Open
                </Link>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(c)}>
                  Merge into this one
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MergeDialog
        patient={patient}
        candidate={confirming}
        onClose={() => setConfirming(null)}
        onDone={(name) => {
          setConfirming(null);
          setCandidates((prev) => prev.filter((c) => c.id !== confirming?.id));
          toast.success(`${name} merged. Their history is now on this record.`);
          onMerged();
        }}
      />
    </div>
  );
}

function MergeDialog({
  patient, candidate, onClose, onDone,
}: {
  patient: Patient;
  candidate: Candidate | null;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  if (!candidate) return null;

  // The fields that disagree. Shown because that is where a wrong merge
  // becomes visible: two people living at different addresses, or born
  // ten years apart, are not one person whatever else matches.
  const rows: { label: string; keep: string; other: string }[] = [
    { label: 'Name', keep: patient.name, other: candidate.name },
    { label: 'Phone', keep: patient.phone ?? '—', other: candidate.phone ?? '—' },
    { label: 'Age', keep: patient.age != null ? String(patient.age) : '—', other: candidate.age != null ? String(candidate.age) : '—' },
    { label: 'Date of birth', keep: date(patient.dob), other: date(candidate.dob) },
    { label: 'Sex', keep: patient.gender ?? '—', other: candidate.gender ?? '—' },
    { label: 'Address', keep: patient.address ?? '—', other: candidate.address ?? '—' },
  ];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {candidate.name} into {patient.name}?</DialogTitle>
          <DialogDescription>
            Everything on {candidate.uhid} — {candidate.visits} visit
            {candidate.visits === 1 ? '' : 's'}, with its case sheets, prescriptions, certificates,
            invoices and lab orders — moves onto {patient.uhid}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border/10">
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 border-b border-border/10 bg-foreground/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span />
              <span>Keeping ({patient.uhid})</span>
              <span>Merging in ({candidate.uhid})</span>
            </div>
            {rows.map((r) => {
              const differs = r.keep !== r.other && r.keep !== '—' && r.other !== '—';
              return (
                <div
                  key={r.label}
                  className={cn(
                    'grid grid-cols-[auto_1fr_1fr] gap-x-3 px-3 py-1.5 text-[11px]',
                    differs && 'bg-ink-danger/5',
                  )}
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="truncate">{r.keep}</span>
                  <span className={cn('truncate', differs && 'text-ink-danger')}>{r.other}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Rows marked in red disagree. Allergies and chronic conditions from both records are
            kept and combined — nothing clinical is dropped. Blank fields on {patient.uhid} are
            filled in from {candidate.uhid}; fields that already have a value are left alone.
          </p>

          <p className="flex items-start gap-1.5 rounded-lg border border-ink-danger/25 bg-ink-danger/10 p-2.5 text-[11px] text-ink-danger">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>This cannot be undone.</strong> Once the two histories are interleaved there
              is no way to tell which record each entry came from. If you are not sure these are
              the same person, open the other record first.
            </span>
          </p>

          {error && <p className="text-[11px] text-ink-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<ArrowRight size={13} />}
            onClick={async () => {
              setError(null);
              try {
                await apiFetch(`/patients/${patient.id}/merge`, {
                  method: 'POST',
                  data: { duplicateId: candidate.id },
                });
                onDone(candidate.name);
              } catch (e) {
                const message = e instanceof ApiError ? e.message : 'Could not merge these records.';
                setError(message);
                toast.error(message);
              }
            }}
          >
            Merge, keeping {patient.uhid}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
