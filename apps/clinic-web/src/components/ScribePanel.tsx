import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Square, NotebookPen, AlertTriangle, X, Plus, Trash2, Check } from 'lucide-react';
import { Button } from './Button';
import { Pick } from './Field';
import { DoseInput } from './DoseInput';
import { DatePicker } from './DatePicker';
import { todayInput } from '../lib/date';
import { clock, useScribe, type Draft } from '../contexts/ScribeContext';

/**
 * The clinic assistant, on the visit screen.
 *
 * The doctor taps once, talks to the patient as they always do, and taps
 * again. While they talk the note writes itself in front of them; when
 * they stop it becomes theirs to check, change and confirm.
 *
 * This is only the VIEW. The microphone and the note live in
 * contexts/ScribeContext.tsx, above every screen, so the doctor can leave
 * this page mid-consultation to look something up and the listening goes
 * on (components/ScribeDock.tsx is what they see while they are away).
 *
 * ── What this screen owes the doctor ─────────────────────────────────
 *
 *  - Nothing is saved until Confirm. Every field is theirs to change.
 *  - Every medicine shows the words it was heard in, and says when a dose
 *    is their own usual rather than something that was said.
 *  - What the assistant could not place is listed, not dropped: a missed
 *    line is the error nobody notices on a draft that looks complete.
 *  - If listening is not set up, or the service is down, they can type or
 *    paste and get the same draft. The consultation never waits on this.
 */

const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'STAT'];

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Text that is written out, the way a person writes it.
 *
 * When more is added to what is already there, only the new part is
 * written; when it changes outright, it is written again from the start.
 * Someone who has asked their device for less motion gets the text at
 * once.
 */
function Written({ text }: { text: string }) {
  const [shown, setShown] = useState(REDUCED_MOTION ? text : '');
  const shownRef = useRef(shown);
  useEffect(() => {
    if (REDUCED_MOTION || shownRef.current === text) { shownRef.current = text; setShown(text); return; }
    let at = text.startsWith(shownRef.current) ? shownRef.current.length : 0;
    const timer = setInterval(() => {
      at = Math.min(text.length, at + 2);
      shownRef.current = text.slice(0, at);
      setShown(shownRef.current);
      if (at >= text.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [text]);
  const writing = shown.length < text.length;
  return <>{shown}{writing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-foreground/70" aria-hidden="true" />}</>;
}

/**
 * The note as it is being written, during the consultation.
 *
 * Read-only on purpose: it is still changing under the doctor's eyes, and
 * a field that rewrites itself while someone is typing in it is worse
 * than one they cannot touch for a minute. It becomes theirs to edit the
 * moment they stop the listening.
 */
function LiveNote({ note }: { note: Draft | null }) {
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border/10 last:border-0 sm:grid-cols-[110px_1fr]">
      <dt className="text-[12px] font-medium text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-[14px] leading-relaxed min-h-[1.4em]">
        {value ? <Written text={value} /> : <span className="text-muted-foreground/50">Not heard yet</span>}
      </dd>
    </div>
  );
  const vitals = note
    ? ([['BP', note.vitals.bp], ['Temp', note.vitals.temp], ['SpO2', note.vitals.spo2], ['Pulse', note.vitals.pulse], ['Weight', note.vitals.weight]] as const)
        .filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('   ')
    : '';
  return (
    <dl className="mt-3 rounded-lg bg-background/70 border border-border/15 px-3 sm:px-4">
      {row('Complaint', note?.chiefComplaint ?? '')}
      {row('History', note?.hopi ?? '')}
      {row('Vitals', vitals)}
      {row('Diagnosis', note?.diagnosis ?? '')}
      <div className="grid grid-cols-[88px_1fr] gap-3 py-2 border-b border-border/10 sm:grid-cols-[110px_1fr]">
        <dt className="text-[12px] font-medium text-muted-foreground pt-0.5">Medicines</dt>
        <dd className="text-[14px] leading-relaxed min-h-[1.4em]">
          {note && note.medicines.length > 0 ? (
            <ol className="flex flex-col gap-1.5">
              {note.medicines.map((m, i) => {
                const danger = note.flags.find((f) => f.medicine === i && f.level === 'danger');
                return (
                  <li key={m.drugName + i}>
                    <span className="font-semibold"><Written text={m.drugName} /></span>
                    <span className="text-foreground/75">
                      <Written text={[m.dosage, m.frequency, m.duration, m.instructions].filter(Boolean).map((p) => `  ·  ${p}`).join('')} />
                    </span>
                    {danger && <span className="mt-0.5 flex items-start gap-1.5 text-[13px] font-semibold text-ink-danger"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />{danger.message}</span>}
                  </li>
                );
              })}
            </ol>
          ) : <span className="text-muted-foreground/50">Not heard yet</span>}
        </dd>
      </div>
      {row('Tests', note?.labTests.join(', ') ?? '')}
      {row('Advice', note?.notes ?? '')}
      {row('Come back', note?.followUpInDays ? `In ${note.followUpInDays} day${note.followUpInDays === 1 ? '' : 's'}` : '')}
    </dl>
  );
}

export function ScribePanel({ appointmentId, patientName, onSaved }: { appointmentId: string; patientName: string; onSaved: () => void }) {
  const s = useScribe();
  const [consent, setConsent] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [showHeard, setShowHeard] = useState(false);

  if (!s.status) return null;
  const mine = s.appointmentId === appointmentId;

  // ── Busy with another patient ───────────────────────────────────────
  if (s.phase !== 'idle' && !mine) {
    return (
      <section className="mb-6 p-4 rounded-xl border border-border/15 bg-foreground/[0.03]">
        <h3 className="text-[15px] font-semibold">The assistant is with {s.patientName}</h3>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {s.phase === 'review' ? 'Their note is waiting to be checked.' : 'It is still listening to that visit.'} Finish that one before starting here.
        </p>
        <Link to={`/appointments/${s.appointmentId}/encounter`} className="mt-2 inline-block text-[13px] font-semibold text-ink-success hover:underline">
          Go to {s.patientName}’s visit →
        </Link>
      </section>
    );
  }

  // ── Review ──────────────────────────────────────────────────────────
  if (s.phase === 'review' && s.note) {
    const note = s.note;
    const general = note.flags.filter((f) => f.medicine === undefined);
    const input = 'w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary';
    const small = 'px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-primary';
    const save = async () => { if (await s.confirm()) onSaved(); };
    return (
      <section className="mb-6 p-4 rounded-xl border border-border/15 bg-foreground/[0.03] flex flex-col gap-4" aria-label="The assistant's draft note">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><NotebookPen size={15} /> Draft note</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">Read it through and change anything. Nothing is saved until you confirm.</p>
        </div>

        {general.map((f, i) => (
          <div key={i} className={`px-3 py-2 rounded-lg text-[13px] ${f.level === 'danger' ? 'tone-danger' : f.level === 'warning' ? 'tone-warning' : 'bg-accent/60'}`}>{f.message}</div>
        ))}

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Complaint
          <textarea rows={2} value={note.chiefComplaint} onChange={(e) => s.patchNote({ chiefComplaint: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">History
          <textarea rows={3} value={note.hopi} onChange={(e) => s.patchNote({ hopi: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {/* Labelled above, not by placeholder: a placeholder vanishes the
              moment a value is filled in, and a draft arrives filled in --
              so "99" and "18" sat side by side with nothing saying which
              was the temperature and which the weight. */}
          {(['bp', 'temp', 'spo2', 'weight', 'pulse'] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ bp: 'BP', temp: 'Temp', spo2: 'SpO2', weight: 'Weight (kg)', pulse: 'Pulse' }[key]}
              <input value={note.vitals[key] ?? ''} onChange={(e) => s.patchNote({ vitals: { ...note.vitals, [key]: e.target.value } })} className={`${small} text-foreground`} />
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Diagnosis
          <input value={note.diagnosis} onChange={(e) => s.patchNote({ diagnosis: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Advice and notes
          <textarea rows={2} value={note.notes} onChange={(e) => s.patchNote({ notes: e.target.value })} className={`${input} text-foreground`} />
        </label>

        <div>
          <h4 className="text-[13px] font-semibold mb-2">Medicines</h4>
          {note.medicines.length === 0 && <p className="text-[13px] text-muted-foreground">No medicine was heard.</p>}
          <div className="flex flex-col gap-4">
            {note.medicines.map((m, i) => {
              // What is missing is worked out from the line as it stands
              // now, not from what the assistant said when it first wrote
              // it: the doctor has been filling it in since.
              const missing = [!m.dosage.trim() && 'dose', !m.frequency && 'frequency', !m.duration.trim() && 'duration'].filter(Boolean) as string[];
              const flags = note.flags.filter((f) => f.medicine === i && f.kind !== 'missing');
              const blocking = s.incomplete === i;
              return (
                <div key={i} className={`grid grid-cols-2 sm:grid-cols-12 gap-2 items-start rounded-lg ${blocking ? 'ring-2 ring-ink-danger/60 p-2 -m-2' : ''}`}>
                  <input
                    aria-label="Medicine name" value={m.drugName}
                    // Editing the name by hand breaks the link to the
                    // catalogue row: stock is decremented against that
                    // link, so it must only survive an exact pick.
                    onChange={(e) => s.patchMedicine(i, { drugName: e.target.value, drugId: null, composition: null, match: 'none', approximate: false })}
                    className={`col-span-2 sm:col-span-4 ${small}`}
                  />
                  <DoseInput className="col-span-2 sm:col-span-3" label={`Dose for ${m.drugName}`} value={m.dosage} onChange={(d) => s.patchMedicine(i, { dosage: d })} />
                  <Pick className="col-span-1 sm:col-span-2" value={m.frequency} placeholder="Frequency" onChange={(f) => s.patchMedicine(i, { frequency: f })} options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
                  <input aria-label="Duration" placeholder="Duration, e.g. 5 days" value={m.duration} onChange={(e) => s.patchMedicine(i, { duration: e.target.value })} className={`col-span-1 sm:col-span-2 ${small} ${blocking && !m.duration.trim() ? 'border-ink-danger' : ''}`} />
                  <button type="button" onClick={() => s.removeMedicine(i)} aria-label={`Remove ${m.drugName}`} className="col-span-2 sm:col-span-1 min-h-[36px] flex items-center justify-center text-muted-foreground/70 hover:text-ink-danger"><Trash2 size={14} /></button>
                  <input aria-label="Instructions" placeholder="Instructions (optional)" value={m.instructions} onChange={(e) => s.patchMedicine(i, { instructions: e.target.value })} className={`col-span-2 sm:col-span-11 ${small}`} />

                  <div className="col-span-2 sm:col-span-12 flex flex-col gap-1 text-[12px]">
                    {m.composition && <span className="text-muted-foreground">{m.composition}</span>}
                    {m.source && <span className="text-muted-foreground">Heard: “{m.source}”</span>}
                    {m.notes.map((n, x) => <span key={x} className="text-ink-info">{n}</span>)}
                    {missing.length > 0 && (
                      <span className={`flex items-start gap-1.5 ${blocking ? 'text-ink-danger font-semibold' : 'text-ink-warning'}`}>
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        Still needs a {missing.join(' and a ')}.
                      </span>
                    )}
                    {flags.map((f, x) => (
                      <span key={x} className={`flex items-start gap-1.5 ${f.level === 'danger' ? 'text-ink-danger font-semibold' : 'text-ink-warning'}`}>
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{f.message}
                      </span>
                    ))}
                    {m.alternatives.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">Or:
                        {m.alternatives.map((a) => (
                          <button type="button" key={a.id} onClick={() => s.patchMedicine(i, { drugId: a.id, drugName: a.name, composition: a.composition, match: 'catalogue', approximate: false, alternatives: [], source: m.source })}
                            className="px-2 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/80">{a.name}</button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => s.patchNote({ medicines: [...note.medicines, { spoken: '', drugId: null, drugName: '', composition: null, match: 'none', approximate: false, alternatives: [], dosage: '', frequency: 'OD', duration: '', instructions: '', source: '', notes: [] }] })}
            className="mt-3 flex items-center gap-1 text-xs text-ink-success hover:underline"><Plus size={12} /> Add a medicine</button>
        </div>

        {note.labTests.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold mb-2">Tests to order</h4>
            <div className="flex flex-wrap gap-1.5">
              {note.labTests.map((t) => (
                <span key={t} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-foreground/5 text-xs">
                  {t}
                  <button type="button" onClick={() => s.patchNote({ labTests: note.labTests.filter((x) => x !== t) })} aria-label={`Do not order ${t}`} className="p-1 rounded hover:bg-foreground/10"><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-up date</label>
          <DatePicker value={s.followUpDate} onChange={s.setFollowUpDate} label="Follow-up date" placeholder="No follow-up" min={todayInput()} clearable />
        </div>

        {note.leftover.length > 0 && (
          <div className="rounded-lg border border-border/15 p-3">
            <h4 className="text-[13px] font-semibold">Said, but not placed in the note</h4>
            <p className="text-[12px] text-muted-foreground mb-2">Check nothing here should be in it.</p>
            <ul className="flex flex-col gap-1.5">
              {note.leftover.map((line, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
                  <span>{line}</span>
                  <button type="button" onClick={() => s.patchNote({ notes: note.notes ? `${note.notes}\n${line}` : line, leftover: note.leftover.filter((_, x) => x !== i) })}
                    className="shrink-0 text-xs text-ink-success hover:underline">Add to notes</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What else the consultation called for. Separate from the note
            on purpose: each is its own record, saved by its own Confirm,
            and none of them waits on the note or is held up by it. */}
        {s.also.some((c) => c.state !== 'dismissed') && (
          <div>
            <h4 className="text-[13px] font-semibold">Also from this consultation</h4>
            <p className="text-[12px] text-muted-foreground mb-2">Each of these is saved on its own, when you confirm it.</p>
            <div className="flex flex-col gap-2">
              {s.also.map((card, i) => card.state === 'dismissed' ? null : (
                <div key={i} className="rounded-lg border border-border/15 bg-background/60 p-3">
                  <div className="text-[14px] font-semibold">{card.title}</div>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {card.lines.map((line, x) => (
                      <li key={x} className={`flex gap-3 text-[13px] ${line.tone === 'danger' ? 'text-ink-danger font-semibold' : line.tone === 'warning' ? 'text-ink-warning' : line.tone === 'muted' ? 'text-muted-foreground' : ''}`}>
                        {line.label && <span className="w-28 shrink-0 text-[12px] font-medium text-muted-foreground pt-px">{line.label}</span>}
                        <span className="min-w-0 flex-1">{line.text}</span>
                      </li>
                    ))}
                  </ul>
                  {card.state === 'done' ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-success"><Check size={14} aria-hidden="true" /> {card.said ?? 'Saved.'}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" icon={<Check size={13} />} busyLabel="Saving…" onClick={() => s.confirmAlso(i)}>Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => s.dismissAlso(i)}>Not needed</Button>
                      {card.said && <span className="text-[12px] text-ink-warning" role="alert">{card.said}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <button type="button" onClick={() => setShowHeard((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2" aria-expanded={showHeard}>
            {showHeard ? 'Hide what was heard' : 'Show everything that was heard'}
          </button>
          {showHeard && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-3 text-[13px] text-foreground/80">{s.transcript}</p>}
        </div>

        {/* Beside the button it answers. It used to sit at the top of the
            note, a screen above the Save button, so a save that was
            refused looked like a save that was simply taking for ever. */}
        {s.error && <div className="px-3 py-2 rounded-lg tone-danger text-sm" role="alert">{s.error}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} busyLabel="Saving…">Confirm and save</Button>
          <Button variant="ghost" onClick={s.discard}>Discard</Button>
          <span className="text-[12px] text-muted-foreground">{note.engine.reason}</span>
        </div>
      </section>
    );
  }

  // ── Listening ───────────────────────────────────────────────────────
  if (s.phase === 'listening' || s.phase === 'finishing') {
    return (
      <section className="mb-6 p-4 rounded-xl border border-ink-danger/30 bg-ink-danger/5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold">
            {s.phase === 'listening'
              ? <><span className="h-2.5 w-2.5 rounded-full bg-ink-danger animate-pulse" aria-hidden="true" /> Listening · {clock(s.elapsed)}</>
              : 'Reading it through once more…'}
          </div>
          {s.phase === 'listening' && <Button variant="danger" icon={<Square size={13} />} onClick={s.finish}>Stop and check the note</Button>}
        </div>
        {/* What it is doing, and how much of the visit it has actually
            heard. If two people have been talking for five minutes and
            this says thirty seconds, the microphone is too far away --
            and the doctor can see that now rather than discover it in a
            thin note at the end. */}
        {s.phase === 'listening' && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            {s.doing} · speech heard {clock(s.sentSeconds)} · you can open other screens, it keeps listening
          </p>
        )}
        {s.error && <div className="mt-3 px-3 py-2 rounded-lg tone-warning text-sm">{s.error}</div>}
        <LiveNote note={s.live} />
        {s.transcript && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            <span className="font-medium">Just heard: </span>
            {/* The end of it: the newest words are the ones worth showing. */}
            {s.transcript.length > 220 ? `…${s.transcript.slice(-220)}` : s.transcript}
          </p>
        )}
      </section>
    );
  }

  // ── Idle ────────────────────────────────────────────────────────────
  return (
    <section className="mb-6 p-4 rounded-xl border border-border/15 bg-foreground/[0.03]">
      <h3 className="text-[15px] font-semibold">Let the assistant write this visit</h3>
      <p className="text-[13px] text-muted-foreground mt-0.5">
        {s.status.canListen
          ? 'It listens while you talk to the patient, and writes the note and prescription as you go for you to check.'
          : 'Type or paste your notes in any order, and it will sort them into the note and prescription for you to check.'}
      </p>
      {s.error && <div className="mt-3 px-3 py-2 rounded-lg tone-danger text-sm" role="alert">{s.error}</div>}

      {s.status.canListen && !typing && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              The patient has agreed to this consultation being recorded to write their notes.
              <span className="block text-muted-foreground mt-0.5">
                The recording is not kept. Their name, phone number, address and file number are removed before the note is written.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Mic size={14} />} disabled={!consent} onClick={async () => { await s.start(appointmentId, patientName); setConsent(false); }}>Start listening</Button>
            <button type="button" onClick={() => setTyping(true)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Type or paste instead</button>
          </div>
        </div>
      )}

      {(typing || !s.status.canListen) && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            rows={5} value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="Complaint fever three days. BP 120 by 80. Diagnosis viral fever. Tab Dolo 650 thrice a day for 3 days after food. Do a CBC. Review after 5 days."
            className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<NotebookPen size={14} />} disabled={typed.trim().length < 10} // Cleared only once the note exists: if it could not be made,
              // what was typed is the only copy of it.
              onClick={async () => { if (await s.makeFromTyped(appointmentId, patientName, typed)) { setTyped(''); setTyping(false); } }}>Make the note</Button>
            {s.status.canListen && <button type="button" onClick={() => setTyping(false)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Listen instead</button>}
          </div>
        </div>
      )}
    </section>
  );
}
