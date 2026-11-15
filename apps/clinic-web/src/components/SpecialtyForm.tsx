import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from './Button';
import { Pick } from './Field';
import { FIELD } from './hosp';
import { preview, showValue, type Answers, type FormField, type FormSection, type PreviewContext } from '../lib/specialty';

/*
 * One renderer for every specialty form.
 *
 * Nothing in here knows what a pregnancy or an eye is: it draws whatever
 * fields the form definition lists, in the order it lists them, so a
 * clinic's own form looks and behaves exactly like a built-in one. Fields
 * sit in a grid that a doctor scans left to right the way the paper card
 * reads; long answers and tables take a full line.
 */

const AREA = 'w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring';

export function FormFields({ sections, values, onChange, ctx }: {
  sections: FormSection[];
  values: Answers;
  onChange: (next: Answers) => void;
  ctx: PreviewContext;
}) {
  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });
  return (
    <div className="space-y-5">
      {sections.map((s) => {
        const fields = s.fields.filter((f) => !f.retired || hasValue(values[f.key]));
        if (!fields.length) return null;
        return (
          <fieldset key={s.title}>
            <legend className="mb-2.5 text-[13px] font-semibold text-muted-foreground">{s.title}</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {fields.map((f) => (
                <div key={f.key} className={f.wide || f.type === 'table' || f.type === 'textarea' || f.type === 'multi' ? 'sm:col-span-2 lg:col-span-4' : ''}>
                  <OneField field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} computed={f.type === 'computed' ? preview(f, values, ctx) : null} />
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function hasValue(v: unknown) {
  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
}

function Label({ id, field }: { id?: string; field: FormField }) {
  return (
    <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-foreground/85">
      {field.label}
      {field.unit && field.type !== 'table' && <span className="font-normal text-muted-foreground"> ({field.unit})</span>}
      {field.hint && <span className="mt-0.5 block text-[12px] font-normal leading-snug text-muted-foreground">{field.hint}</span>}
    </label>
  );
}

function OneField({ field: f, value, onChange, computed }: { field: FormField; value: unknown; onChange: (v: unknown) => void; computed: string | null }) {
  const id = useId();
  switch (f.type) {
    case 'computed':
      return (
        <div>
          <Label field={f} />
          <div className="flex h-9 items-center rounded-md bg-accent/60 px-3 text-[14px] font-medium" aria-live="polite">
            {computed ? showValue(f, computed) : <span className="font-normal text-muted-foreground">Filled in from the answers</span>}
          </div>
        </div>
      );
    case 'textarea':
      return (<div><Label id={id} field={f} /><textarea id={id} rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={AREA} /></div>);
    case 'number':
      return (
        <div>
          <Label id={id} field={f} />
          <input id={id} inputMode="decimal" value={String(value ?? '')} onChange={(e) => onChange(e.target.value.replace(/[^\d.\-]/g, ''))}
            placeholder={f.min !== undefined && f.max !== undefined ? `${f.min}–${f.max}` : undefined} className={`${FIELD} tabular-nums`} />
        </div>
      );
    case 'date':
      return (<div><Label id={id} field={f} /><input id={id} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={FIELD} /></div>);
    case 'select':
      return (<div><Label id={id} field={f} /><Pick id={id} value={String(value ?? '')} onChange={onChange} emptyLabel="—" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} /></div>);
    case 'multi': {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div role="group" aria-label={f.label}>
          <Label field={f} />
          <div className="flex flex-wrap gap-1.5">
            {(f.options ?? []).map((o) => {
              const on = picked.includes(o);
              return (
                <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])}
                  className={`rounded-md border px-2.5 py-1 text-[13px] transition-colors ${on ? 'border-transparent bg-primary text-primary-foreground' : 'border-input/60 bg-background hover:bg-foreground/[0.04]'}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case 'yesno':
      return (
        <div role="group" aria-label={f.label}>
          <Label field={f} />
          <div className="inline-flex rounded-md border border-input/60 p-0.5">
            {([true, false] as const).map((b) => (
              <button key={String(b)} type="button" aria-pressed={value === b} onClick={() => onChange(value === b ? undefined : b)}
                className={`h-8 rounded px-3.5 text-[13px] font-medium ${value === b ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/[0.05]'}`}>
                {b ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      );
    case 'table':
      return <TableField field={f} value={value} onChange={onChange} />;
    default:
      return (<div><Label id={id} field={f} /><input id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={FIELD} /></div>);
  }
}

type Row = Record<string, unknown> & { row?: string };

/** Rows of small fields: each eye, each follicle-bearing ovary, each dose given. */
function TableField({ field: f, value, onChange }: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const fixed = f.rows ?? [];
  const extra = fixed.length ? rows.filter((r) => !fixed.includes(String(r.row ?? ''))) : rows;
  const shown: { key: string; row: Row; fixedLabel?: string }[] = [
    ...fixed.map((label) => ({ key: `f:${label}`, row: rows.find((r) => r.row === label) ?? { row: label }, fixedLabel: label })),
    ...extra.map((r, i) => ({ key: `x:${i}`, row: r })),
  ];
  const write = (target: Row, key: string, v: unknown) => {
    const next = { ...target, [key]: v };
    if (target.row && fixed.includes(target.row)) {
      onChange([...rows.filter((r) => r.row !== target.row), next]);
    } else {
      onChange(rows.map((r) => (r === target ? next : r)));
    }
  };
  const cols = f.columns ?? [];
  const canAdd = !fixed.length || f.addRows;
  // A long schedule (the vaccines) opens on the rows already filled, unless
  // nothing is filled yet, when the whole schedule is the useful view.
  const filledFixed = (s: { row: Row; fixedLabel?: string }) => !s.fixedLabel || Object.keys(s.row).some((k) => k !== 'row' && hasValue(s.row[k]));
  const [showAllFixed, setShowAllFixed] = useState(() => fixed.length <= 12 || !rows.some((r) => fixed.includes(String(r.row ?? ''))));
  const visible = showAllFixed ? shown : shown.filter(filledFixed);
  return (
    <div>
      <Label field={f} />
      <div className="overflow-x-auto rounded-md border border-border/15">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead>
            <tr className="border-b border-border/15 bg-accent/40 text-left text-[12px] text-muted-foreground">
              {(fixed.length > 0 || f.addRows) && <th className="px-2.5 py-1.5 font-medium" />}
              {cols.map((c) => <th key={c.key} className="px-2 py-1.5 font-medium">{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
              {canAdd && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ key, row, fixedLabel }) => (
              <tr key={key} className="border-b border-border/10 last:border-0">
                {(fixed.length > 0 || f.addRows) && (
                  <td className="whitespace-nowrap px-2.5 py-1 text-[13px] font-medium">
                    {fixedLabel ?? (
                      <input aria-label="Row" value={String(row.row ?? '')} onChange={(e) => write(row, 'row', e.target.value)} placeholder="Name" className="h-8 w-40 rounded border border-input/60 bg-background px-2 text-[13px]" />
                    )}
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c.key} className="px-1.5 py-1">
                    <Cell field={c} value={row[c.key]} onChange={(v) => write(row, c.key, v)} label={`${fixedLabel ?? f.label}: ${c.label}`} />
                  </td>
                ))}
                {canAdd && (
                  <td className="px-1">
                    {!fixedLabel && (
                      <button type="button" aria-label="Remove row" onClick={() => onChange(rows.filter((r) => r !== row))} className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"><X size={14} /></button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex gap-3">
        {canAdd && (
          <button type="button" onClick={() => onChange([...rows, {}])} className="inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">
            <Plus size={13} /> Add a row
          </button>
        )}
        {fixed.length > 12 && (
          <button type="button" onClick={() => setShowAllFixed((v) => !v)} className="text-[13px] font-medium underline-offset-4 hover:underline">
            {showAllFixed ? 'Show only filled rows' : `Show all ${fixed.length} rows`}
          </button>
        )}
      </div>
    </div>
  );
}

function Cell({ field: c, value, onChange, label }: { field: FormField; value: unknown; onChange: (v: unknown) => void; label: string }) {
  const cls = 'h-8 w-full min-w-[5rem] rounded border border-input/60 bg-background px-2 text-[13px] outline-none focus:border-ring';
  if (c.type === 'select') {
    return (
      <select aria-label={label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} className={cls}>
        <option value="">—</option>
        {(c.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (c.type === 'date') return <input aria-label={label} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={cls} />;
  if (c.type === 'number') return <input aria-label={label} inputMode="decimal" value={String(value ?? '')} onChange={(e) => onChange(e.target.value.replace(/[^\d.\-]/g, ''))} className={`${cls} tabular-nums`} />;
  return <input aria-label={label} value={String(value ?? '')} placeholder={c.hint} onChange={(e) => onChange(e.target.value)} className={cls} />;
}

/** A form being filled in, with its save and cancel. */
export function RecordEditor({ title, note, sections, initial, ctx, onSave, onCancel, saveLabel = 'Save', children }: {
  title: string;
  note?: string;
  sections: FormSection[];
  initial?: Answers;
  ctx: PreviewContext;
  onSave: (values: Answers) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
  /** extra controls above the fields, e.g. the visit date or the partner */
  children?: React.ReactNode;
}) {
  const [values, setValues] = useState<Answers>(() => ({ ...(initial ?? {}) }));
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    try { await onSave(values); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  };
  return (
    <section className="rounded-xl border border-border/20 bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">{title}</h3>
          {note && <p className="mt-1 text-[13px] text-muted-foreground">{note}</p>}
        </div>
        <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" aria-label="Close"><X size={16} /></button>
      </div>
      {children}
      <FormFields sections={sections} values={values} onChange={setValues} ctx={ctx} />
      {error && <p role="alert" className="mt-4 rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="primary" onClick={save}>{saveLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}

/** A filled form, read back: every answer under its section, tables as tables. */
export function Answered({ sections, data }: { sections: FormSection[]; data: Answers }) {
  return (
    <div className="space-y-3">
      {sections.map((s) => {
        const filled = s.fields.filter((f) => hasValue(data[f.key]));
        if (!filled.length) return null;
        return (
          <div key={s.title}>
            <p className="mb-1 text-[12.5px] font-semibold text-muted-foreground">{s.title}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
              {filled.map((f) => f.type === 'table' ? (
                <div key={f.key} className="sm:col-span-2">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 overflow-x-auto">
                    <table className="text-[13px]">
                      <tbody>
                        {(data[f.key] as Row[]).map((r, i) => (
                          <tr key={i}>
                            {r.row && <td className="pr-3 font-medium">{r.row}</td>}
                            {(f.columns ?? []).filter((c) => hasValue(r[c.key])).map((c) => (
                              <td key={c.key} className="pr-3"><span className="text-muted-foreground">{c.label} </span>{showValue(c, r[c.key])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </dd>
                </div>
              ) : (
                <div key={f.key} className={f.type === 'textarea' || f.type === 'multi' ? 'sm:col-span-2' : 'flex gap-2'}>
                  <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium">{showValue(f, data[f.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
