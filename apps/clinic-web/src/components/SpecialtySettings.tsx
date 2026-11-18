import { useCallback, useEffect, useState } from 'react';
import { Plus, X, GripVertical, Eye } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from './Button';
import { Pick } from './Field';
import { FIELD, FieldLabel } from './hosp';
import { SkeletonList } from './Skeleton';
import { useToast } from './Toast';
import { allFields, type FieldType, type FormDef, type FormField } from '../lib/specialty';

/*
 * Settings → Specialty forms.
 *
 * The library a clinic starts with, grouped by speciality. Each form can be
 * switched off (it stops being offered; records made with it stay), given
 * the clinic's own extra fields, and a clinic can make forms of its own
 * from the same field types. A field taken away is kept, hidden, on the
 * server, so records that used it still read.
 */

const KIND_WORDS: Record<FormDef['kind'], string> = {
  history: 'Kept up to date',
  visit: 'Filled at each visit',
  episode: 'A pregnancy or treatment, with its visits',
};

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'One of a list' },
  { value: 'multi', label: 'Several from a list' },
  { value: 'yesno', label: 'Yes or no' },
];

interface Draft {
  key?: string;
  label: string;
  type: FieldType;
  unit: string;
  options: string;
  hint: string;
  required: boolean;
  wide: boolean;
}
const toDraft = (f: FormField): Draft => ({
  key: f.key,
  label: f.label,
  type: f.type,
  unit: f.unit ?? '',
  options: (f.options ?? []).join(', '),
  hint: f.hint ?? '',
  required: !!f.required,
  wide: !!f.wide,
});
const fromDraft = (d: Draft) => ({
  key: d.key,
  label: d.label.trim(),
  type: d.type,
  ...(d.type === 'number' && d.unit.trim() ? { unit: d.unit.trim() } : {}),
  ...(d.type === 'select' || d.type === 'multi' ? { options: d.options.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
  ...(d.hint.trim() ? { hint: d.hint.trim() } : {}),
  ...(d.required ? { required: true } : {}),
  ...(d.wide ? { wide: true } : {}),
});

export function SpecialtySettings() {
  const toast = useToast();
  const [forms, setForms] = useState<FormDef[] | null>(null);
  const [editing, setEditing] = useState<FormDef | 'new' | null>(null);

  const load = useCallback(async () => {
    try { setForms((await apiFetch<{ forms: FormDef[] }>('/specialty/forms')).forms); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not load the forms.'); setForms([]); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (f: FormDef) => {
    try {
      const r = await apiFetch<{ forms: FormDef[] }>(`/specialty/forms/${f.key}`, { method: 'PUT', data: { isActive: !f.isActive } });
      setForms(r.forms);
      toast.success(`${f.title} ${f.isActive ? 'switched off' : 'switched on'}.`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not change it.'); }
  };

  if (!forms) return <SkeletonList rows={6} label="Loading the forms" />;
  const groups = new Map<string, FormDef[]>();
  for (const f of forms) groups.set(f.specialty, [...(groups.get(f.specialty) ?? []), f]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-[14px] text-muted-foreground">
          The forms doctors and nurses fill for each speciality. Switch off what this clinic does not use, add your own questions to a form, or make a new one.
        </p>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>Make a form</Button>
      </div>

      {editing && (
        <FormEditor form={editing === 'new' ? null : editing} specialties={[...groups.keys()]}
          onSaved={(next) => { setForms(next); setEditing(null); }} onCancel={() => setEditing(null)} />
      )}

      <div className="space-y-5">
        {[...groups.entries()].map(([specialty, list]) => (
          <section key={specialty}>
            <h3 className="mb-2 text-[15px] font-semibold">{specialty}</h3>
            <ul className="divide-y divide-border/10 overflow-hidden rounded-xl border border-border/15 bg-card">
              {list.map((f) => {
                const own = f.builtIn ? allFields(f).filter((x) => x.key.startsWith('c_') && !x.retired).length : 0;
                const count = allFields(f).filter((x) => !x.retired).length;
                return (
                  <li key={f.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14.5px] font-medium ${f.isActive ? '' : 'text-muted-foreground line-through'}`}>{f.title}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {[KIND_WORDS[f.kind], `${count} questions`, own ? `${own} of yours` : null, f.custom ? 'your form' : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>{f.custom ? 'Edit' : 'Your questions'}</Button>
                    <button type="button" role="switch" aria-checked={f.isActive} aria-label={`${f.title} ${f.isActive ? 'on' : 'off'}`} onClick={() => toggle(f)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${f.isActive ? 'bg-primary' : 'bg-foreground/20'}`}>
                      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${f.isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

const EMPTY_DRAFT: Draft = { label: '', type: 'text', unit: '', options: '', hint: '', required: false, wide: false };

function FormEditor({ form, specialties, onSaved, onCancel }: {
  form: FormDef | null; specialties: string[]; onSaved: (forms: FormDef[]) => void; onCancel: () => void;
}) {
  const toast = useToast();
  const custom = !form || form.custom;
  const start = form ? allFields(form).filter((f) => !f.retired && (custom || f.key.startsWith('c_'))) : [];
  const [title, setTitle] = useState(form?.title ?? '');
  const [specialty, setSpecialty] = useState(form?.specialty ?? '');
  const [kind, setKind] = useState<'history' | 'visit'>(form?.kind === 'history' ? 'history' : 'visit');
  const [drafts, setDrafts] = useState<Draft[]>(start.length ? start.map(toDraft) : custom ? [{ ...EMPTY_DRAFT }] : []);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const set = (i: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i: number) => setDrafts(drafts.filter((_, j) => j !== i));
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = drafts.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setDrafts(next);
  };

  const save = async () => {
    const fields = drafts.filter((d) => d.label.trim()).map(fromDraft);
    try {
      const r = !form
        ? await apiFetch<{ forms: FormDef[] }>('/specialty/forms', { method: 'POST', data: { title, specialty, kind, fields } })
        : custom
          ? await apiFetch<{ forms: FormDef[] }>(`/specialty/forms/${form.key}`, { method: 'PUT', data: { title, specialty, fields } })
          : await apiFetch<{ forms: FormDef[] }>(`/specialty/forms/${form.key}`, { method: 'PUT', data: { extraFields: fields } });
      toast.success('Saved.');
      onSaved(r.forms);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border/20 bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border/10 px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-[16px] font-semibold">{!form ? 'A new form' : custom ? form.title : `Your questions on ${form.title}`}</h3>
          {form && !custom && <p className="mt-1 text-[13px] text-muted-foreground">They appear at the end of the form, under "Your clinic's fields". The built-in questions stay as they are.</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors ${showPreview ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-foreground/[0.06]'}`}
            aria-pressed={showPreview}
          >
            <Eye size={13} /> Preview
          </button>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06]"><X size={16} /></button>
        </div>
      </div>

      <div className={`grid gap-0 ${showPreview ? 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]' : ''}`}>
        <div className="p-4 sm:p-5">
          {custom && (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><FieldLabel htmlFor="sf-title">Name</FieldLabel><input id="sf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Allergy test, Audiometry…" className={FIELD} /></div>
              <div>
                <FieldLabel htmlFor="sf-spec">Speciality</FieldLabel>
                <input id="sf-spec" list="sf-specs" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="ENT, Dermatology…" className={FIELD} />
                <datalist id="sf-specs">{specialties.map((s) => <option key={s} value={s} />)}</datalist>
              </div>
              {!form && (
                <div><FieldLabel>Filled</FieldLabel><Pick value={kind} onChange={(v) => setKind(v as 'history' | 'visit')} options={[{ value: 'visit', label: 'At each visit' }, { value: 'history', label: 'Once, kept up to date' }]} /></div>
              )}
            </div>
          )}

          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Questions</p>
          <ol className="space-y-2">
            {drafts.map((d, i) => (
              <li
                key={d.key ?? `new-${i}`}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null) reorder(dragFrom, i); setDragFrom(null); }}
                onDragEnd={() => setDragFrom(null)}
                className={`rounded-lg bg-accent/40 p-2.5 transition-opacity ${dragFrom === i ? 'opacity-40' : ''}`}
              >
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[18px_minmax(0,1fr)_170px_minmax(0,1fr)_32px]">
                  <span className="hidden cursor-grab text-muted-foreground active:cursor-grabbing sm:flex sm:h-9 sm:items-center sm:justify-center" aria-hidden="true"><GripVertical size={14} /></span>
                  <div><FieldLabel htmlFor={`q-${i}`}>Question</FieldLabel><input id={`q-${i}`} value={d.label} onChange={(e) => set(i, { label: e.target.value })} className={FIELD} /></div>
                  <div><FieldLabel>Answer</FieldLabel><Pick value={d.type} onChange={(v) => set(i, { type: v as FieldType })} options={TYPES} /></div>
                  <div>
                    {d.type === 'number' && (<><FieldLabel htmlFor={`u-${i}`}>Unit</FieldLabel><input id={`u-${i}`} value={d.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder="mg/dL, cm…" className={FIELD} /></>)}
                    {(d.type === 'select' || d.type === 'multi') && (<><FieldLabel htmlFor={`o-${i}`} hint="(commas between)">Choices</FieldLabel><input id={`o-${i}`} value={d.options} onChange={(e) => set(i, { options: e.target.value })} placeholder="Mild, Moderate, Severe" className={FIELD} /></>)}
                  </div>
                  <button type="button" aria-label="Remove question" onClick={() => remove(i)} className="flex h-9 items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"><X size={15} /></button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[18px_minmax(0,1fr)_minmax(0,220px)] sm:items-end">
                  <span className="hidden sm:block" />
                  <div>
                    <FieldLabel htmlFor={`h-${i}`} hint="(small grey text under the box)">Hint</FieldLabel>
                    <input id={`h-${i}`} value={d.hint} onChange={(e) => set(i, { hint: e.target.value })} placeholder="e.g. Enter fasting sugar" className={FIELD} />
                  </div>
                  <div className="flex items-center gap-4 pb-1.5 sm:pb-2">
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="checkbox" checked={d.required} onChange={(e) => set(i, { required: e.target.checked })} />
                      Required
                    </label>
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="checkbox" checked={d.wide} onChange={(e) => set(i, { wide: e.target.checked })} />
                      Full width
                    </label>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setDrafts([...drafts, { ...EMPTY_DRAFT }])} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">
            <Plus size={13} /> Add a question
          </button>
          <p className="mt-3 text-[12.5px] text-muted-foreground">A question taken away stops being asked; what was already written with it stays on those records. Changing a question's answer type starts it afresh, and earlier answers stay with the old one. Fetal sex cannot be recorded on any form (PC-PNDT Act).</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={save}>Save</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </div>

        {showPreview && (
          <aside className="border-border/15 bg-accent/20 p-4 sm:p-5 lg:border-l">
            <p className="mb-3 text-[13px] font-semibold text-muted-foreground">Preview</p>
            <FormPreview title={custom ? (title || 'Untitled') : form!.title} drafts={drafts} customSection={!custom} />
          </aside>
        )}
      </div>
    </section>
  );
}

/**
 * Renders the form the way the doctor will see it, from the drafts in
 * the editor. Pure display -- any value typed into a preview input is
 * discarded, the preview resets on every edit to the form itself.
 */
function FormPreview({ title, drafts, customSection }: { title: string; drafts: Draft[]; customSection: boolean }) {
  const active = drafts.filter((d) => d.label.trim());
  if (!active.length) return <p className="text-[13px] text-muted-foreground">Add a question to see the preview.</p>;
  return (
    <div className="rounded-lg border border-border/15 bg-background p-4">
      <p className="mb-3 text-[14px] font-semibold">{title}</p>
      {customSection && <p className="mb-3 text-[12.5px] text-muted-foreground">Your clinic's fields</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {active.map((d, i) => (
          <div key={i} className={d.wide ? 'sm:col-span-2' : ''}>
            <label className="mb-1 block text-[12.5px] font-medium">
              {d.label}
              {d.required && <span className="ml-0.5 text-ink-danger">*</span>}
              {d.type === 'number' && d.unit && <span className="ml-1 text-muted-foreground">({d.unit})</span>}
            </label>
            {previewInput(d)}
            {d.hint && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{d.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function previewInput(d: Draft) {
  if (d.type === 'textarea') return <textarea disabled className={`${FIELD} resize-none`} rows={2} />;
  if (d.type === 'number') return <input type="number" disabled placeholder={d.unit ? `in ${d.unit}` : undefined} className={FIELD} />;
  if (d.type === 'date') return <input type="date" disabled className={FIELD} />;
  if (d.type === 'yesno') return (
    <div className="flex gap-3 pt-1">
      <label className="flex items-center gap-1 text-[13px]"><input type="radio" disabled /> Yes</label>
      <label className="flex items-center gap-1 text-[13px]"><input type="radio" disabled /> No</label>
    </div>
  );
  if (d.type === 'select') {
    const opts = d.options.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <select disabled className={FIELD}>
        <option>Choose…</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (d.type === 'multi') {
    const opts = d.options.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {opts.length ? opts.map((o) => (
          <label key={o} className="flex items-center gap-1 text-[12.5px]"><input type="checkbox" disabled /> {o}</label>
        )) : <span className="text-[12px] text-muted-foreground">(add choices)</span>}
      </div>
    );
  }
  return <input type="text" disabled className={FIELD} />;
}
