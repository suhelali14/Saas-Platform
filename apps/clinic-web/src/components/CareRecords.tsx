import { useAssistantChanged } from '../lib/assistant-changed';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Button } from './Button';
import { Pick } from './Field';
import { Chip, FIELD, FieldLabel, PatientPicker, type PickedPatient } from './hosp';
import { Answered, RecordEditor } from './SpecialtyForm';
import { useToast } from './Toast';
import {
  RELATION_WORDS, allFields, longDate, showValue, todayIso,
  type Answers, type Episode, type FormDef, type FormField, type Relation, type RelationKind, type SpecialtyOverview, type SpecialtyRecord,
} from '../lib/specialty';

/*
 * A patient's specialty records.
 *
 * Three kinds of thing, each laid out the way a clinic keeps it on paper:
 *   - an episode (a pregnancy, an infertility treatment) is a card with
 *     its particulars at the top and one row per visit underneath -- the
 *     antenatal card, the follicle chart;
 *   - a history (menstrual history, birth history, vaccines) is one page
 *     that is kept up to date;
 *   - other visit forms (an eye examination, a physiotherapy session) are
 *     a table per form, newest first.
 *
 * In `visit` mode (the consultation screen) it shows only what the doctor
 * needs mid-visit: the open episodes, the forms suggested for this doctor
 * and patient, and what has been recorded at this visit.
 */

export function useSpecialty(patientId: string | undefined, appointmentId?: string) {
  const [data, setData] = useState<SpecialtyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The assistant changed something: show it.
  useAssistantChanged(() => { void load(); });
  const load = useCallback(async () => {
    if (!patientId) return;
    try {
      setData(await apiFetch<SpecialtyOverview>(`/patients/${patientId}/specialty${appointmentId ? `?appointmentId=${appointmentId}` : ''}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the specialty records.');
    }
  }, [patientId, appointmentId]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}

type Editing =
  | { kind: 'record'; def: FormDef; episode?: Episode; record?: SpecialtyRecord }
  | { kind: 'episode'; def: FormDef; episode?: Episode }
  | { kind: 'close'; def: FormDef; episode: Episode }
  | null;

export interface PatientBasics { id: string; name: string; age: number | null; gender: string | null; dob?: string | null }

export function CareRecords({ patient, data, reload, mode = 'patient', appointmentId }: {
  patient: PatientBasics;
  data: SpecialtyOverview;
  reload: () => Promise<void>;
  mode?: 'patient' | 'visit';
  appointmentId?: string;
}) {
  const { user, isAdmin } = useClinicAuth();
  const toast = useToast();
  const role = user?.role ?? '';
  const isDoctor = role === 'DOCTOR';
  const canRecord = isDoctor || role === 'NURSE';
  const canFamily = isDoctor || role === 'NURSE' || role === 'RECEPTIONIST' || isAdmin;
  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState(false);

  const forms = useMemo(() => new Map(data.forms.map((f) => [f.key, f])), [data.forms]);
  const open = data.episodes.filter((e) => e.status === 'ACTIVE');
  const closed = data.episodes.filter((e) => e.status === 'CLOSED');
  const ctxFor = (episode?: Episode | null, on = todayIso()) => ({ recordedOn: on, episode: episode?.data ?? null, dob: patient.dob ?? null, age: patient.age });

  const saveRecord = async (def: FormDef, values: Answers, episode?: Episode, record?: SpecialtyRecord) => {
    if (record) await apiFetch(`/records/${record.id}`, { method: 'PUT', data: { data: values } });
    else await apiFetch(`/patients/${patient.id}/records`, { method: 'POST', data: { formKey: def.key, episodeId: episode?.id, appointmentId, data: values } });
    toast.success(`${def.title} saved.`);
    setEditing(null);
    await reload();
  };
  const saveEpisode = async (def: FormDef, values: Answers, partnerId: string, episode?: Episode) => {
    if (episode) await apiFetch(`/episodes/${episode.id}`, { method: 'PUT', data: { data: values, partnerId: partnerId || null } });
    else await apiFetch(`/patients/${patient.id}/episodes`, { method: 'POST', data: { formKey: def.key, data: values, partnerId: partnerId || null } });
    toast.success(episode ? 'Saved.' : `${def.title} record opened.`);
    setEditing(null);
    await reload();
  };
  const closeEpisode = async (episode: Episode, values: Answers) => {
    await apiFetch(`/episodes/${episode.id}/close`, { method: 'POST', data: { outcome: values } });
    toast.success(`${episode.title} record closed.`);
    setEditing(null);
    await reload();
  };
  const startForm = (def: FormDef) => {
    setPicking(false);
    if (def.kind === 'episode') setEditing({ kind: 'episode', def });
    else if (def.kind === 'history') {
      const existing = data.history.find((h) => h.formKey === def.key);
      setEditing({ kind: 'record', def, record: existing });
    } else setEditing({ kind: 'record', def });
  };

  const suggested = data.suggested.map((k) => forms.get(k)).filter((f): f is FormDef => !!f);
  const thisVisit = appointmentId
    ? [...data.visits, ...data.episodes.flatMap((e) => e.records)].filter((r) => r.appointmentId === appointmentId)
    : [];

  const editor = editing && (
    editing.kind === 'record' ? (
      <RecordEditor
        key={`${editing.def.key}:${editing.record?.id ?? 'new'}`}
        title={editing.record ? `${editing.def.title} · ${longDate(editing.record.recordedOn)}` : editing.def.title}
        note={editing.def.note}
        sections={editing.def.sections}
        initial={editing.record?.data}
        ctx={ctxFor(editing.episode ?? data.episodes.find((e) => e.id === editing.record?.episodeId), editing.record?.recordedOn)}
        onSave={(v) => saveRecord(editing.def, v, editing.episode, editing.record).catch(rethrow)}
        onCancel={() => setEditing(null)}
      />
    ) : editing.kind === 'episode' ? (
      <EpisodeEditor def={editing.def} episode={editing.episode} relations={data.relations} ctx={ctxFor(null)}
        onSave={(v, partnerId) => saveEpisode(editing.def, v, partnerId, editing.episode).catch(rethrow)} onCancel={() => setEditing(null)} />
    ) : (
      <RecordEditor
        title={`Close: ${editing.episode.title}`}
        sections={editing.def.closeSections ?? []}
        ctx={ctxFor(editing.episode)}
        saveLabel="Close the record"
        onSave={(v) => closeEpisode(editing.episode, v).catch(rethrow)}
        onCancel={() => setEditing(null)}
      />
    )
  );

  const picker = picking && (
    <FormPicker forms={data.forms} suggested={data.suggested} history={data.history} openEpisodes={open}
      isDoctor={isDoctor} onPick={startForm} onClose={() => setPicking(false)} />
  );

  // ── Consultation view ───────────────────────────────────────────────
  if (mode === 'visit') {
    return (
      <section className="mb-6 rounded-xl border border-border/15 bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Forms for this visit</h2>
          {canRecord && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setPicking((v) => !v)}>Another form</Button>}
        </div>
        {open.map((e) => {
          const def = forms.get(e.formKey);
          return (
            <div key={e.id} className="mb-3 rounded-lg bg-accent/45 px-3 py-2.5">
              <p className="text-[14px]">
                <span className="font-semibold">{e.title}</span>
                {e.gaToday && <span className="font-semibold"> · {e.gaToday}</span>}
                {e.viaPartner && <span className="text-muted-foreground"> · on {e.patient.name}'s record</span>}
              </p>
              {e.summary && <p className="text-[13px] text-muted-foreground">{e.summary}</p>}
              {e.records.length > 0 && <p className="mt-1 text-[13px]"><span className="text-muted-foreground">Last visit {longDate(e.records[e.records.length - 1]!.recordedOn)}: </span>{e.records[e.records.length - 1]!.summary}</p>}
              {canRecord && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(def?.visitForms ?? []).map((k) => forms.get(k)).filter((f): f is FormDef => !!f && f.isActive).map((vf) => (
                    <Button key={vf.key} size="sm" variant="secondary" onClick={() => setEditing({ kind: 'record', def: vf, episode: e })}>{vf.title}</Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {canRecord && suggested.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] text-muted-foreground">For this visit:</span>
            {suggested.filter((f) => f.kind !== 'episode' || isDoctor).map((f) => (
              <Button key={f.key} size="sm" variant="secondary" onClick={() => startForm(f)}>
                {f.kind === 'episode' ? `Start ${f.title.toLowerCase()} record` : f.kind === 'history' && data.history.some((h) => h.formKey === f.key) ? `Update ${f.title.toLowerCase()}` : f.title}
              </Button>
            ))}
          </div>
        )}
        {!open.length && !suggested.length && !thisVisit.length && !picking && !editing && (
          <p className="text-[13px] text-muted-foreground">No specialty forms for this visit. Use "Another form" for a pregnancy, an eye examination, a growth visit and so on.</p>
        )}
        {picker}
        {editor && <div className="mt-3">{editor}</div>}
        {thisVisit.length > 0 && (
          <div className="mt-3 border-t border-border/15 pt-3">
            <h3 className="mb-1.5 text-[13px] font-medium text-muted-foreground">Filled in on this visit</h3>
            {/* One line for each form, saying what it holds now. A form
                saved more than once used to be listed once per save, and
                seven identical lines told nobody which one counted. */}
            <ul className="space-y-2">
              {[...new Set(thisVisit.map((r) => r.formKey))].map((key) => {
                const saves = thisVisit.filter((r) => r.formKey === key).sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
                const latest = saves[0]!;
                const at = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
                return (
                  <li key={key} className="text-[14px]">
                    <p>
                      <span className="font-medium">{forms.get(key)?.title ?? key}</span>
                      {latest.summary && <span className="text-muted-foreground"> · {latest.summary}</span>}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">Saved at {at(latest.updatedAt ?? latest.createdAt)} by {latest.recordedByName}</p>
                    {saves.length > 1 && (
                      <details className="mt-0.5">
                        <summary className="cursor-pointer text-[12.5px] text-muted-foreground">{saves.length - 1} earlier {saves.length === 2 ? 'entry' : 'entries'} of this form today</summary>
                        <ul className="mt-1 space-y-0.5 border-l border-border/20 pl-3">
                          {saves.slice(1).map((r) => <li key={r.id} className="text-[13px] text-muted-foreground">{at(r.createdAt)} · {r.summary || 'No values'}</li>)}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // ── Patient record view ─────────────────────────────────────────────
  const visitGroups = new Map<string, SpecialtyRecord[]>();
  for (const r of data.visits) visitGroups.set(r.formKey, [...(visitGroups.get(r.formKey) ?? []), r]);
  const nothing = !data.episodes.length && !data.history.length && !data.visits.length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">Specialty records</h2>
        {canRecord && <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>Add a record</Button>}
      </div>
      {picker}
      {editor && <div className="mb-4">{editor}</div>}

      <Family patientId={patient.id} relations={data.relations} linkedFrom={data.linkedFrom} canEdit={canFamily} reload={reload} />

      {[...open, ...closed].map((e) => (
        <EpisodeCard key={e.id} episode={e} forms={forms} canRecord={canRecord} isDoctor={isDoctor}
          onRecord={(vf) => setEditing({ kind: 'record', def: vf, episode: e })}
          onEditRecord={(r) => { const vf = forms.get(r.formKey); if (vf) setEditing({ kind: 'record', def: vf, episode: e, record: r }); }}
          onEdit={() => { const def = forms.get(e.formKey); if (def) setEditing({ kind: 'episode', def, episode: e }); }}
          onClose={() => { const def = forms.get(e.formKey); if (def) setEditing({ kind: 'close', def, episode: e }); }}
          reload={reload} />
      ))}

      {data.history.map((h) => {
        const def = forms.get(h.formKey);
        if (!def) return null;
        return (
          <Collapsible key={h.id} title={def.title} meta={`Updated ${longDate(h.recordedOn)} by ${h.recordedByName}`} summary={h.summary}
            action={canRecord ? <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditing({ kind: 'record', def, record: h })}>Update</Button> : null}>
            <Answered sections={def.sections} data={h.data} />
          </Collapsible>
        );
      })}

      {[...visitGroups.entries()].map(([key, rows]) => {
        const def = forms.get(key);
        if (!def) return null;
        return (
          <div key={key} className="mb-3 rounded-xl border border-border/15 bg-card p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold">{def.title} <span className="font-normal text-muted-foreground">· {rows.length}</span></h3>
              {canRecord && def.isActive && <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setEditing({ kind: 'record', def })}>New</Button>}
            </div>
            <Trends def={def} records={[...rows].reverse()} />
            <VisitTable def={def} records={rows} canEdit={canRecord} isDoctor={isDoctor} onEdit={(r) => setEditing({ kind: 'record', def, record: r })} reload={reload} />
          </div>
        );
      })}

      {nothing && !editing && (
        <p className="rounded-xl border border-dashed border-border/25 px-5 py-6 text-center text-[14px] text-muted-foreground">
          No specialty records yet. A pregnancy, a menstrual history, a child's growth and vaccines, an eye examination — each is kept here, visit by visit.
        </p>
      )}
    </section>
  );
}

const rethrow = (e: unknown): never => { throw new Error(e instanceof ApiError ? e.message : 'Could not save.'); };

// ── Choosing a form ────────────────────────────────────────────────────

function FormPicker({ forms, suggested, history, openEpisodes, isDoctor, onPick, onClose }: {
  forms: FormDef[]; suggested: string[]; history: SpecialtyRecord[]; openEpisodes: Episode[]; isDoctor: boolean;
  onPick: (f: FormDef) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const openKinds = new Set(openEpisodes.filter((e) => !e.viaPartner).map((e) => e.formKey));
  const usable = forms.filter((f) => f.isActive && !f.episodeKey && !(f.kind === 'episode' && (openKinds.has(f.key) || !isDoctor)));
  const term = q.trim().toLowerCase();
  const shown = usable.filter((f) => !term || f.title.toLowerCase().includes(term) || f.specialty.toLowerCase().includes(term));
  const groups = new Map<string, FormDef[]>();
  for (const f of shown) groups.set(f.specialty, [...(groups.get(f.specialty) ?? []), f]);
  const label = (f: FormDef) => (f.kind === 'episode' ? `Start a ${f.title.toLowerCase()} record` : f.kind === 'history' && history.some((h) => h.formKey === f.key) ? `Update ${f.title.toLowerCase()}` : f.title);
  const top = shown.filter((f) => suggested.includes(f.key));
  return (
    <div className="mb-4 rounded-xl border border-border/20 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a form — pregnancy, eye, growth…" aria-label="Find a form" className={FIELD} />
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {top.length > 0 && !term && (
        <div className="mb-3">
          <p className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">Suggested for this patient</p>
          <div className="flex flex-wrap gap-1.5">{top.map((f) => <Button key={f.key} size="sm" variant="secondary" onClick={() => onPick(f)}>{label(f)}</Button>)}</div>
        </div>
      )}
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...groups.entries()].map(([specialty, list]) => (
          <div key={specialty}>
            <p className="mb-1 text-[12.5px] font-semibold text-muted-foreground">{specialty}</p>
            <ul>
              {list.map((f) => (
                <li key={f.key}>
                  <button type="button" onClick={() => onPick(f)} className="w-full rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-foreground/[0.05]">{label(f)}</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!shown.length && <p className="text-[14px] text-muted-foreground">No form matches. An admin can make one in Settings → Specialty forms.</p>}
    </div>
  );
}

// ── Episodes ───────────────────────────────────────────────────────────

function EpisodeEditor({ def, episode, relations, ctx, onSave, onCancel }: {
  def: FormDef; episode?: Episode; relations: Relation[]; ctx: { recordedOn: string; dob: string | null; age: number | null };
  onSave: (values: Answers, partnerId: string) => Promise<void>; onCancel: () => void;
}) {
  // A new record suggests the spouse; an existing one keeps exactly what it
  // has, including no partner -- a record left unlinked on purpose (the
  // listed husband is not the father) must not be linked by an edit.
  const [partnerId, setPartnerId] = useState(episode ? episode.partnerId ?? '' : relations.find((r) => r.kind === 'SPOUSE' || r.kind === 'PARTNER')?.id ?? '');
  const partners = relations.filter((r) => r.kind === 'SPOUSE' || r.kind === 'PARTNER');
  return (
    <RecordEditor title={episode ? `${def.title}: details` : `Start a ${def.title.toLowerCase()} record`} note={def.note} sections={def.sections}
      initial={episode?.data} ctx={ctx} onSave={(v) => onSave(v, partnerId)} onCancel={onCancel} saveLabel={episode ? 'Save' : 'Open the record'}>
      {def.couple && (
        <div className="mb-5 max-w-sm">
          <FieldLabel hint={partners.length ? undefined : '(add them under Family first)'}>Partner</FieldLabel>
          <Pick value={partnerId} onChange={setPartnerId} emptyLabel="Not linked" options={partners.map((r) => ({ value: r.id, label: `${r.name} (${RELATION_WORDS[r.kind].toLowerCase()})` }))} />
        </div>
      )}
    </RecordEditor>
  );
}

function EpisodeCard({ episode: e, forms, canRecord, isDoctor, onRecord, onEditRecord, onEdit, onClose, reload }: {
  episode: Episode; forms: Map<string, FormDef>; canRecord: boolean; isDoctor: boolean;
  onRecord: (vf: FormDef) => void; onEditRecord: (r: SpecialtyRecord) => void; onEdit: () => void; onClose: () => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const def = forms.get(e.formKey);
  const [details, setDetails] = useState(false);
  const visitDefs = (def?.visitForms ?? []).map((k) => forms.get(k)).filter((f): f is FormDef => !!f);
  const openNow = e.status === 'ACTIVE';
  const partnerName = e.partner?.name ?? null;
  const reopen = async () => {
    try { await apiFetch(`/episodes/${e.id}/reopen`, { method: 'POST' }); toast.success('Reopened.'); await reload(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Could not reopen.'); }
  };
  return (
    <article className={`mb-4 rounded-xl border bg-card p-4 ${openNow ? 'border-border/25' : 'border-border/15'}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
            {e.title}
            {openNow ? <Chip tone="good">Open</Chip> : <Chip tone="quiet">Closed {longDate(e.closedOn)}</Chip>}
            {e.gaToday && <span className="text-[15px]">{e.gaToday} today</span>}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[
              `Since ${longDate(e.startedOn)}`,
              partnerName ? `with ${partnerName}` : null,
              e.viaPartner ? `kept on ${e.patient.name}'s record` : null,
              `opened by ${e.createdByName}`,
            ].filter(Boolean).join(' · ')}
            {e.viaPartner && <> · <Link to={`/patients/${e.patient.id}`} className="underline-offset-4 hover:underline">open it</Link></>}
          </p>
          {e.summary && <p className="mt-1.5 text-[14px]">{e.summary}</p>}
          {e.outcome && (
            <p className="mt-1 text-[14px]"><span className="text-muted-foreground">Outcome: </span>{String(e.outcome.outcome ?? '')}{e.outcome.ended_on ? `, ${longDate(String(e.outcome.ended_on))}` : ''}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {openNow && canRecord && visitDefs.filter((v) => v.isActive).map((v) => (
            <Button key={v.key} size="sm" variant="primary" icon={<Plus size={12} />} onClick={() => onRecord(v)}>{v.title}</Button>
          ))}
          {isDoctor && !e.viaPartner && openNow && <Button size="sm" variant="ghost" onClick={onEdit}>Edit details</Button>}
          {isDoctor && !e.viaPartner && openNow && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
          {isDoctor && !e.viaPartner && !openNow && <Button size="sm" variant="ghost" onClick={reopen}>Reopen</Button>}
        </div>
      </header>

      {visitDefs.map((vd) => {
        const rows = e.records.filter((r) => r.formKey === vd.key);
        if (!rows.length) return null;
        return (
          <div key={vd.key} className="mt-4">
            <p className="mb-1.5 text-[13px] font-semibold text-muted-foreground">{vd.title} · {rows.length}</p>
            <Trends def={vd} records={rows} />
            <VisitTable def={vd} records={[...rows].reverse()} canEdit={canRecord && openNow} isDoctor={isDoctor} onEdit={onEditRecord} reload={reload} />
          </div>
        );
      })}

      {def && (
        <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">
          {details ? <ChevronDown size={14} /> : <ChevronRight size={14} />} All particulars
        </button>
      )}
      {details && def && (
        <div className="mt-2 rounded-lg bg-accent/35 p-3">
          <Answered sections={def.sections} data={e.data} />
          {e.outcome && def.closeSections && <div className="mt-3"><Answered sections={def.closeSections} data={e.outcome} /></div>}
        </div>
      )}
    </article>
  );
}

// ── Visit rows and trends ──────────────────────────────────────────────

/** Columns for a form's visits: its summary keys, with systolic and diastolic as one BP column. */
function columnsFor(def: FormDef): { key: string; label: string; field?: FormField }[] {
  const byKey = new Map(allFields(def).map((f) => [f.key, f]));
  const keys = def.summary?.length ? def.summary : allFields(def).filter((f) => f.type !== 'table' && f.type !== 'textarea').slice(0, 6).map((f) => f.key);
  const cols: { key: string; label: string; field?: FormField }[] = [];
  for (const k of keys) {
    if (k === 'bp_diastolic') continue;
    if (k === 'bp_systolic') { cols.push({ key: 'bp', label: 'BP' }); continue; }
    const f = byKey.get(k);
    if (f) cols.push({ key: k, label: f.short || f.label.replace(/\s*\(.*?\)\s*/g, ' ').trim(), field: f });
  }
  return cols;
}

function cellText(r: SpecialtyRecord, c: { key: string; field?: FormField }) {
  if (c.key === 'bp') return r.data.bp_systolic != null && r.data.bp_diastolic != null ? `${r.data.bp_systolic}/${r.data.bp_diastolic}` : '';
  return c.field ? showValue({ ...c.field, unit: undefined }, r.data[c.key]) : '';
}

function VisitTable({ def, records, canEdit, isDoctor, onEdit, reload }: {
  def: FormDef; records: SpecialtyRecord[]; canEdit: boolean; isDoctor: boolean; onEdit: (r: SpecialtyRecord) => void; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const cols = columnsFor(def);
  const byKey = new Map(allFields(def).map((f) => [f.key, f]));
  const remove = async (r: SpecialtyRecord) => {
    if (!window.confirm(`Remove this ${def.title.toLowerCase()} from ${longDate(r.recordedOn)}? Only for a record made by mistake today.`)) return;
    try { await apiFetch(`/records/${r.id}`, { method: 'DELETE' }); toast.success('Removed.'); await reload(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not remove it.'); }
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border/15">
      <table className="w-full min-w-[560px] text-[13.5px]">
        <thead>
          <tr className="border-b border-border/15 bg-accent/40 text-left text-[12px] text-muted-foreground">
            <th className="px-3 py-1.5 font-medium">Date</th>
            {cols.map((c) => <th key={c.key} className="px-2 py-1.5 font-medium">{c.label}{c.key === 'bp' ? ' (mmHg)' : c.field?.unit ? ` (${c.field.unit})` : ''}</th>)}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <Fragment key={r.id}>
              <tr className="cursor-pointer border-b border-border/10 hover:bg-foreground/[0.02]" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                <td className="whitespace-nowrap px-3 py-1.5 font-medium">{longDate(r.recordedOn)}</td>
                {cols.map((c) => <td key={c.key} className={`px-2 py-1.5 tabular-nums ${c.key === 'ga' || c.key === 'bp' || c.field?.type === 'number' || c.field?.type === 'computed' ? 'whitespace-nowrap' : ''}`}>{cellText(r, c) || <span className="text-muted-foreground/50">—</span>}</td>)}
                <td className="px-2 text-muted-foreground">{openId === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
              </tr>
              {openId === r.id && (
                <tr className="border-b border-border/10 bg-accent/25">
                  <td colSpan={cols.length + 2} className="px-3 py-3">
                    <Answered sections={def.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => byKey.has(f.key)) }))} data={r.data} />
                    <p className="mt-2 text-[12.5px] text-muted-foreground">Recorded by {r.recordedByName}</p>
                    {canEdit && (
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" variant="secondary" icon={<Pencil size={12} />} onClick={() => onEdit(r)}>Correct</Button>
                        {isDoctor && Date.now() - new Date(r.createdAt).getTime() < 24 * 3_600_000 && (
                          <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => remove(r)}>Remove</Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A small line for each measure the form charts -- weight, BP, fundal
 * height across a pregnancy; a child's weight and height. Read as a shape
 * beside its first and latest values; the table below holds each number.
 */
function Trends({ def, records }: { def: FormDef; records: SpecialtyRecord[] }) {
  const byKey = new Map(allFields(def).map((f) => [f.key, f]));
  const series = (def.trend ?? [])
    .map((k) => ({ field: byKey.get(k), points: records.map((r) => Number(r.data[k])).filter((n) => Number.isFinite(n)) }))
    .filter((s): s is { field: FormField; points: number[] } => !!s.field && s.points.length >= 2);
  if (!series.length) return null;
  return (
    <div className="mb-2.5 flex flex-wrap gap-x-6 gap-y-2">
      {series.map(({ field, points }) => {
        const w = 88, h = 26, min = Math.min(...points), max = Math.max(...points);
        const y = (v: number) => 2 + (max === min ? 0.5 : 1 - (v - min) / (max - min)) * (h - 4);
        const d = points.map((v, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const first = points[0]!, last = points[points.length - 1]!;
        return (
          <div key={field.key} className="flex items-center gap-2">
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${field.label}: ${points.join(', ')}`} className="overflow-visible">
              <polyline points={d} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="text-[12.5px] leading-tight">
              <span className="block text-muted-foreground">{field.label.replace(/\s*\(.*?\)\s*/g, ' ').trim()}</span>
              <span className="tabular-nums">{first} → <span className="font-semibold">{last}</span>{field.unit ? ` ${field.unit}` : ''}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Collapsible({ title, meta, summary, action, children }: { title: string; meta: string; summary: string; action: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-xl border border-border/15 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 text-left">
          <span className="flex items-center gap-1 text-[15px] font-semibold">{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{title}</span>
          <span className="block text-[12.5px] text-muted-foreground">{meta}</span>
          {!open && summary && <span className="mt-1 block text-[14px]">{summary}</span>}
        </button>
        {action}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Family ─────────────────────────────────────────────────────────────

function Family({ patientId, relations, linkedFrom, canEdit, reload }: {
  patientId: string; relations: Relation[]; linkedFrom: Relation[]; canEdit: boolean; reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState<Relation | 'new' | null>(null);
  const remove = async (r: Relation) => {
    if (!window.confirm(`Remove ${r.name} from this patient's family details?`)) return;
    try { await apiFetch(`/relations/${r.id}`, { method: 'DELETE' }); toast.success('Removed.'); await reload(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not remove.'); }
  };
  if (!relations.length && !linkedFrom.length && !canEdit) return null;
  return (
    <div className="mb-4 rounded-xl border border-border/15 bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><Users size={15} aria-hidden="true" /> Family and partner</h3>
        {canEdit && adding === null && <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setAdding('new')}>Add</Button>}
      </div>
      {!relations.length && !linkedFrom.length && adding === null && (
        <p className="text-[13.5px] text-muted-foreground">Husband or wife for an antenatal card, both partners for fertility treatment, parents for a child.</p>
      )}
      <ul className="space-y-1.5 text-[14px]">
        {relations.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              <span className="text-muted-foreground">{RELATION_WORDS[r.kind]}: </span>
              {r.relatedPatient ? <Link to={`/patients/${r.relatedPatient.id}`} className="font-medium underline-offset-4 hover:underline">{r.name}</Link> : <span className="font-medium">{r.name}</span>}
              {[r.age != null ? `${r.age}y` : null, r.bloodGroup ? `blood ${r.bloodGroup}` : null, r.occupation, r.phone, r.relatedPatient ? `patient ${r.relatedPatient.uhid}` : null].filter(Boolean).map((x) => ` · ${x}`).join('')}
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <button type="button" onClick={() => setAdding(r)} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Edit</button>
                <button type="button" onClick={() => remove(r)} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Remove</button>
              </span>
            )}
          </li>
        ))}
        {linkedFrom.map((r) => (
          <li key={`from:${r.id}`}>
            <span className="text-muted-foreground">Listed as {RELATION_WORDS[r.kind].toLowerCase()} of </span>
            <Link to={`/patients/${r.patient!.id}`} className="font-medium underline-offset-4 hover:underline">{r.patient!.name}</Link>
            <span className="text-muted-foreground"> · {r.patient!.uhid}</span>
          </li>
        ))}
      </ul>
      {adding !== null && (
        <RelationForm patientId={patientId} existing={adding === 'new' ? null : adding}
          onDone={async () => { setAdding(null); await reload(); }} onCancel={() => setAdding(null)} />
      )}
    </div>
  );
}

const KINDS = Object.entries(RELATION_WORDS).map(([value, label]) => ({ value, label }));

function RelationForm({ patientId, existing, onDone, onCancel }: { patientId: string; existing: Relation | null; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<RelationKind>(existing?.kind ?? 'SPOUSE');
  const [asPatient, setAsPatient] = useState(!!existing?.relatedPatientId);
  const [picked, setPicked] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({
    name: existing?.relatedPatientId ? '' : existing?.name ?? '', age: existing?.age != null ? String(existing.age) : '', gender: existing?.gender ?? '',
    phone: existing?.phone ?? '', bloodGroup: existing?.bloodGroup ?? '', occupation: existing?.occupation ?? '',
  });
  const save = async () => {
    const body = asPatient
      ? { kind, relatedPatientId: picked?.id ?? existing?.relatedPatientId ?? null, occupation: f.occupation || null }
      : { kind, relatedPatientId: null, name: f.name, age: f.age ? Number(f.age) : null, gender: f.gender || null, phone: f.phone || null, bloodGroup: f.bloodGroup || null, occupation: f.occupation || null };
    try {
      if (existing) await apiFetch(`/relations/${existing.id}`, { method: 'PUT', data: body });
      else await apiFetch(`/patients/${patientId}/relations`, { method: 'POST', data: body });
      toast.success('Saved.');
      onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const input = (k: keyof typeof f, label: string, x: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><FieldLabel htmlFor={`rel-${k}`}>{label}</FieldLabel><input id={`rel-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={FIELD} {...x} /></div>
  );
  return (
    <div className="mt-3 rounded-lg bg-accent/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div><FieldLabel>Relation</FieldLabel><Pick value={kind} onChange={(v) => setKind(v as RelationKind)} options={KINDS} /></div>
        <div>
          <FieldLabel>Who</FieldLabel>
          <div className="inline-flex rounded-md border border-input/60 p-0.5">
            {[[false, 'Their details'], [true, 'A patient here']].map(([v, l]) => (
              <button key={String(v)} type="button" aria-pressed={asPatient === v} onClick={() => setAsPatient(v as boolean)}
                className={`h-8 rounded px-3 text-[13px] font-medium ${asPatient === v ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/[0.05]'}`}>{l as string}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3">
        {asPatient ? (
          <div className="space-y-3">
            <div>
              <FieldLabel hint={existing?.relatedPatientId && !picked ? `(now ${existing.name})` : undefined}>Patient</FieldLabel>
              <PatientPicker value={picked} onChange={setPicked} />
            </div>
            <div className="max-w-sm">{input('occupation', 'Occupation')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">{input('name', 'Name')}</div>
            {input('age', 'Age', { inputMode: 'numeric' })}
            {input('gender', 'Gender')}
            {input('phone', 'Phone', { inputMode: 'tel' })}
            {input('bloodGroup', 'Blood group')}
            {input('occupation', 'Occupation')}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="primary" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
