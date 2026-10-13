import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';
import { Input, Label, Textarea } from './ui';

/**
 * Composes what a printed document contains.
 *
 * ── Why a list and not a canvas ──────────────────────────────────────
 *
 * The obvious answer to "make the template fully customizable" is a
 * drag-and-drop canvas. For medical documents that is arguably the wrong
 * goal: layout consistency across every prescription a clinic issues is
 * closer to a safety property than a preference, and a free-form canvas
 * is exactly how you lose it — it is also how a dosage column ends up on
 * top of a drug name.
 *
 * So the clinic composes from a vocabulary the renderer can actually
 * draw: reorder, rename, hide, add its own text, pick the table's
 * columns and their widths. Everything it can express produces a
 * readable document, which is what lets the controls be this direct.
 *
 * ── Visual weight ────────────────────────────────────────────────────
 *
 * Shown is the normal state and gets no decoration; hidden is the
 * exception and gets the amber chip. The inverse — a green "Shown" badge
 * on every row — was tried on the website builder and left the eye
 * nowhere to rest, with the one hidden row invisible among nine lit ones.
 */

export type BlockConfig = { key: string; label?: string; show: boolean; text?: string };
export type ColumnConfig = { key: string; label?: string; show: boolean; width?: number };
export type KindTemplate = {
  title?: string;
  footerNote?: string;
  blocks: BlockConfig[];
  columns?: ColumnConfig[];
};
export type LetterheadField = { key: string; label?: string; show: boolean };

export type Vocabulary = {
  kinds: { kind: string; blocks: { key: string; label: string; required: boolean; critical: boolean }[] }[];
  letterhead: { key: string; label: string; always: boolean }[];
  medicineColumns: { key: string; label: string; defaultWidth: number }[];
};

const KIND_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  certificate: 'Certificate',
  invoice: 'Invoice',
  report: 'Patient report',
};

/** Moves an item within a list, returning a new array. */
function move<T>(list: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function Reorder({ onUp, onDown, canUp, canDown }: {
  onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean;
}) {
  return (
    // 20x16 each, not a bare 13px glyph. These get clicked repeatedly
    // while arranging a document, and a chevron with no hit area is the
    // thing you miss three times out of four.
    <div className="flex shrink-0 flex-col">
      <button
        type="button" onClick={onUp} disabled={!canUp} aria-label="Move up"
        className="flex h-4 w-5 items-center justify-center rounded-t text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button" onClick={onDown} disabled={!canDown} aria-label="Move down"
        className="flex h-4 w-5 items-center justify-center rounded-b text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <ChevronDown size={12} />
      </button>
    </div>
  );
}

function ShowToggle({ shown, onChange, locked, lockReason }: {
  shown: boolean; onChange: (v: boolean) => void; locked?: boolean; lockReason?: string;
}) {
  if (locked) {
    return (
      <span
        className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
        title={lockReason}
      >
        <Lock size={10} aria-hidden="true" /> always
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChange(!shown)}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors',
        shown
          ? 'text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground'
          : 'bg-warning/15 text-warning hover:bg-warning/25',
      )}
      aria-pressed={!shown}
    >
      {shown ? <Eye size={10} aria-hidden="true" /> : <EyeOff size={10} aria-hidden="true" />}
      {shown ? 'shown' : 'hidden'}
    </button>
  );
}

/** A compact row: name, optional rename field, reorder, show/hide. */
function Row({
  title, hint, critical, children, ...rest
}: {
  title: string;
  hint?: string;
  critical?: boolean;
  children?: React.ReactNode;
  onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-border/10 py-2 last:border-0">
      <Reorder {...rest} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium" title={title}>{title}</span>
          {critical && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-destructive"
              title="Safety information. Moving it below the medicines means a pharmacist reads what to dispense before they read the allergy."
            >
              <AlertTriangle size={9} aria-hidden="true" /> safety
            </span>
          )}
        </div>
        {hint && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/60">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

export function DocumentComposer({
  letterhead, kinds, vocabulary, onChange,
}: {
  letterhead: LetterheadField[];
  kinds: Record<string, KindTemplate>;
  vocabulary: Vocabulary;
  onChange: (patch: { letterhead?: LetterheadField[]; kinds?: Record<string, KindTemplate> }) => void;
}) {
  const [kind, setKind] = useState<string>(vocabulary.kinds[0]?.kind ?? 'prescription');

  const spec = vocabulary.kinds.find((k) => k.kind === kind);
  const blockLabel = (key: string) => spec?.blocks.find((b) => b.key === key)?.label ?? key;
  const blockMeta = (key: string) => spec?.blocks.find((b) => b.key === key);

  // The stored layout, or the vocabulary's own order when the clinic has
  // never touched this kind. Shown rather than left blank so the first
  // edit starts from what is actually being printed today.
  const current: KindTemplate = kinds[kind] ?? {
    blocks: (spec?.blocks ?? []).map((b) => ({ key: b.key, show: true })),
    columns: kind === 'prescription'
      ? vocabulary.medicineColumns.map((c) => ({
          key: c.key,
          show: c.key !== 'composition' && c.key !== 'instructions',
          width: c.defaultWidth,
        }))
      : undefined,
  };

  const patchKind = (next: Partial<KindTemplate>) =>
    onChange({ kinds: { ...kinds, [kind]: { ...current, ...next } } });

  const columns = current.columns ?? [];

  return (
    <div className="space-y-6">
      {/* ── The letterhead's identity lines ───────────────────────────── */}
      <div>
        <h4 className="text-xs font-semibold">What the letterhead prints</h4>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Drag-free reordering: the top of this list is the top of the page. The clinic's name is
          always printed — a document with no issuer is not a document.
        </p>
        <div className="mt-2 rounded-lg border border-border/10 bg-foreground/[0.02] px-3">
          {letterhead.map((field, i) => {
            const meta = vocabulary.letterhead.find((f) => f.key === field.key);
            return (
              <Row
                key={field.key}
                title={meta?.label ?? field.key}
                onUp={() => onChange({ letterhead: move(letterhead, i, -1) })}
                onDown={() => onChange({ letterhead: move(letterhead, i, 1) })}
                canUp={i > 0}
                canDown={i < letterhead.length - 1}
              >
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={field.label ?? ''}
                    placeholder="No prefix"
                    onChange={(e) => {
                      const next = letterhead.slice();
                      next[i] = { ...field, label: e.target.value || undefined };
                      onChange({ letterhead: next });
                    }}
                    className="h-7 flex-1 text-[11px]"
                  />
                  <ShowToggle
                    shown={field.show}
                    locked={meta?.always}
                    lockReason="The clinic's name identifies who issued the document."
                    onChange={(show) => {
                      const next = letterhead.slice();
                      next[i] = { ...field, show };
                      onChange({ letterhead: next });
                    }}
                  />
                </div>
              </Row>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          A prefix is optional — "MCI" prints as "MCI: 12345". Leave it blank for the value alone.
        </p>
      </div>

      {/* ── Per-document layout ───────────────────────────────────────── */}
      <div>
        <h4 className="text-xs font-semibold">Each document's layout</h4>
        <p className="mt-0.5 mb-2 text-[11px] text-muted-foreground">
          Set separately per document, because they are read by different people for different
          reasons — a certificate's wording is a legal matter and an invoice's is a tax one.
        </p>

        <SegmentedControl
          label="Which document to lay out"
          value={kind}
          onChange={setKind}
          options={vocabulary.kinds.map((k) => ({ value: k.kind, label: KIND_LABELS[k.kind] ?? k.kind }))}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="docTitle">Printed title</Label>
            <Input
              id="docTitle"
              value={current.title ?? ''}
              placeholder={KIND_LABELS[kind] ?? kind}
              onChange={(e) => patchKind({ title: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="docFooter">This document's footer note</Label>
            <Input
              id="docFooter"
              value={current.footerNote ?? ''}
              placeholder="Falls back to the clinic-wide note"
              onChange={(e) => patchKind({ footerNote: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Blocks */}
        <div className="mt-4 rounded-lg border border-border/10 bg-foreground/[0.02] px-3">
          {current.blocks.map((block, i) => {
            const meta = block.key === 'custom' ? undefined : blockMeta(block.key);
            const isCustom = block.key === 'custom';
            return (
              <Row
                key={`${block.key}-${i}`}
                title={isCustom ? (block.label || 'Your own text') : blockLabel(block.key)}
                critical={meta?.critical}
                hint={meta?.required ? 'Always printed — the document does not work without it.' : undefined}
                onUp={() => patchKind({ blocks: move(current.blocks, i, -1) })}
                onDown={() => patchKind({ blocks: move(current.blocks, i, 1) })}
                canUp={i > 0}
                canDown={i < current.blocks.length - 1}
              >
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    value={block.label ?? ''}
                    placeholder={isCustom ? 'Heading' : `Default: ${blockLabel(block.key)}`}
                    onChange={(e) => {
                      const next = current.blocks.slice();
                      next[i] = { ...block, label: e.target.value || undefined };
                      patchKind({ blocks: next });
                    }}
                    className="h-7 flex-1 text-[11px]"
                  />
                  <ShowToggle
                    shown={block.show}
                    locked={meta?.required}
                    lockReason="The document does not work without this."
                    onChange={(show) => {
                      const next = current.blocks.slice();
                      next[i] = { ...block, show };
                      patchKind({ blocks: next });
                    }}
                  />
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => patchKind({ blocks: current.blocks.filter((_, j) => j !== i) })}
                      className="shrink-0 rounded p-1 text-muted-foreground/70 hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Remove this block"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                {isCustom && (
                  <Textarea
                    value={block.text ?? ''}
                    onChange={(e) => {
                      const next = current.blocks.slice();
                      next[i] = { ...block, text: e.target.value };
                      patchKind({ blocks: next });
                    }}
                    placeholder="Please bring all previous reports to your next visit."
                    className="mt-1.5 min-h-[52px] text-[11px]"
                  />
                )}
              </Row>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          icon={<Plus size={12} />}
          disabled={current.blocks.filter((b) => b.key === 'custom').length >= 6}
          onClick={() => patchKind({
            blocks: [...current.blocks, { key: 'custom', show: true, label: '', text: '' }],
          })}
        >
          Add your own text block
        </Button>

        {/* Columns, for the one document that has a table the clinic owns */}
        {kind === 'prescription' && columns.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold">The medicines table</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Widths are a guide, not a promise: they are scaled so the table always fills the page,
              which is also why hiding a column gives its space to the others instead of leaving a gap.
            </p>
            <div className="mt-2 rounded-lg border border-border/10 bg-foreground/[0.02] px-3">
              {columns.map((col, i) => {
                const meta = vocabulary.medicineColumns.find((c) => c.key === col.key);
                const locked = col.key === 'name';
                return (
                  <Row
                    key={col.key}
                    title={meta?.label ?? col.key}
                    onUp={() => patchKind({ columns: move(columns, i, -1) })}
                    onDown={() => patchKind({ columns: move(columns, i, 1) })}
                    canUp={i > 0}
                    canDown={i < columns.length - 1}
                  >
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={col.label ?? ''}
                        placeholder={`Default: ${meta?.label ?? col.key}`}
                        onChange={(e) => {
                          const next = columns.slice();
                          next[i] = { ...col, label: e.target.value || undefined };
                          patchKind({ columns: next });
                        }}
                        className="h-7 flex-1 text-[11px]"
                      />
                      <Input
                        type="number"
                        min={18}
                        max={260}
                        value={col.width ?? meta?.defaultWidth ?? 60}
                        onChange={(e) => {
                          const next = columns.slice();
                          next[i] = { ...col, width: Number(e.target.value) };
                          patchKind({ columns: next });
                        }}
                        className="h-7 w-16 text-[11px]"
                        aria-label={`Width of the ${meta?.label ?? col.key} column`}
                      />
                      <ShowToggle
                        shown={col.show}
                        locked={locked}
                        lockReason="A prescription cannot be read without the medicine's name."
                        onChange={(show) => {
                          const next = columns.slice();
                          next[i] = { ...col, show };
                          patchKind({ columns: next });
                        }}
                      />
                    </div>
                  </Row>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
