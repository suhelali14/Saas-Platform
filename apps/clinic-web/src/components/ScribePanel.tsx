import { useEffect, useRef, useState } from 'react';
import { Mic, Square, NotebookPen, AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { apiFetch, apiUpload, ApiError } from '../lib/api';
import { Button } from './Button';
import { Pick } from './Field';
import { DoseInput } from './DoseInput';
import { DatePicker } from './DatePicker';
import { shiftDateInput, todayInput } from '../lib/date';

/**
 * The clinic assistant, on the visit screen.
 *
 * The doctor taps once, talks to the patient as they always do, and taps
 * again. What was said comes back as a filled note -- complaint, history,
 * diagnosis, medicines, tests, follow-up -- for them to read and confirm.
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
 *
 * ── How the audio travels ────────────────────────────────────────────
 *
 * In short pieces, each a complete recording of its own, sent as it ends
 * -- and it ends at a pause. Somebody finishes a sentence and draws
 * breath; that is where the piece is cut, so no word is split in two and
 * what was just said is on its way within a second of being said. The
 * note on screen is rebuilt from every piece, which is what makes it fill
 * in while the doctor is still talking rather than all at once at the end.
 *
 * A piece in which nobody spoke -- the doctor examining, writing, the
 * patient leaving -- is never sent: it would cost money to be told it was
 * silent.
 */

/** A piece is not cut before this, so a short "haan" is not sent alone. */
const PIECE_MIN_MS = 5_000;
/** ...and never runs past this, pause or no pause. The speech service
 *  answers at once only for under thirty seconds. */
const PIECE_MAX_MS = 18_000;
/** How long nobody speaks before it counts as a pause: four samples, 0.8s. */
const PAUSE_SAMPLES = 4;
/** A piece is sent only if speech was heard for at least this share of it. */
const SPEECH_SHARE = 0.06;
/** Loudness above which a moment counts as somebody speaking. */
const SPEECH_LEVEL = 0.02;

const FREQUENCIES = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'STAT'];

interface Candidate { id: string; name: string; composition: string | null }
interface DraftMedicine {
  spoken: string; drugId: string | null; drugName: string; composition: string | null;
  match: 'habit' | 'catalogue' | 'none'; approximate: boolean; alternatives: Candidate[];
  dosage: string; frequency: string; duration: string; instructions: string; source: string; notes: string[];
}
interface Flag { level: 'danger' | 'warning' | 'info'; kind: string; message: string; medicine?: number }
interface Draft {
  chiefComplaint: string; hopi: string; diagnosis: string; notes: string;
  vitals: { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string };
  medicines: DraftMedicine[]; labTests: string[]; followUpInDays: number | null;
  flags: Flag[]; leftover: string[]; engine: { model: string | null; reason: string };
}
interface Status { canListen: boolean; canSummarise: boolean; maxMinutes: number }
interface Session { id: string; transcript: string; status: string; consentAt: string | null; draft: Draft | null }

type Phase = 'idle' | 'listening' | 'finishing' | 'review';

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Text that is written out, the way a person writes it.
 *
 * When more is added to what is already there, only the new part is
 * written; when it changes outright, it is written again from the start.
 * Someone who has asked their device for less motion gets the text at
 * once.
 */
function Written({ text, onWriting }: { text: string; onWriting?: (writing: boolean) => void }) {
  const [shown, setShown] = useState(REDUCED_MOTION ? text : '');
  const shownRef = useRef(shown);
  useEffect(() => {
    if (REDUCED_MOTION || shownRef.current === text) { shownRef.current = text; setShown(text); return; }
    let at = text.startsWith(shownRef.current) ? shownRef.current.length : 0;
    onWriting?.(true);
    const timer = setInterval(() => {
      at = Math.min(text.length, at + 2);
      shownRef.current = text.slice(0, at);
      setShown(shownRef.current);
      if (at >= text.length) { clearInterval(timer); onWriting?.(false); }
    }, 22);
    return () => { clearInterval(timer); onWriting?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const writing = shown.length < text.length;
  return <>{shown}{writing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-foreground/70" aria-hidden="true" />}</>;
}

/** What changed between two versions of the note, in a few words. */
function whatChanged(before: Draft | null, after: Draft): string {
  const added = after.medicines.find((m) => !before?.medicines.some((b) => b.drugName === m.drugName));
  if (added) return `Writing the prescription: ${added.drugName}`;
  if (after.diagnosis && after.diagnosis !== before?.diagnosis) return 'Noting the diagnosis';
  for (const [key, label] of [['bp', 'blood pressure'], ['temp', 'temperature'], ['spo2', 'oxygen level'], ['pulse', 'pulse'], ['weight', 'weight']] as const) {
    if (after.vitals[key] && after.vitals[key] !== before?.vitals[key]) return `Noting the ${label}`;
  }
  const test = after.labTests.find((t) => !before?.labTests.includes(t));
  if (test) return `Adding a test: ${test}`;
  if (after.followUpInDays && after.followUpInDays !== before?.followUpInDays) return 'Noting when to come back';
  if (after.chiefComplaint !== (before?.chiefComplaint ?? '') || after.hopi !== (before?.hopi ?? '')) return 'Writing the history';
  if (after.notes !== (before?.notes ?? '')) return 'Writing the advice';
  return 'Listening';
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

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ScribePanel({ appointmentId, onSaved }: { appointmentId: string; onSaved: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [consent, setConsent] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [transcript, setTranscript] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Draft | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [showHeard, setShowHeard] = useState(false);
  // The note as it stands while still listening, and what was last done to it.
  const [live, setLive] = useState<Draft | null>(null);
  const [doing, setDoing] = useState('Listening');
  const liveRef = useRef<Draft | null>(null);

  // Everything the recorder touches lives in refs: it runs on timers and
  // media callbacks that must see the current value, not the one from the
  // render they were created in.
  const sessionId = useRef<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const listening = useRef(false);
  const pieceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heard = useRef({ speech: 0, total: 0, quiet: 0 });
  const pieceStartedAt = useRef(0);
  /** Ends the piece being recorded now and starts the next one. */
  const cutHere = useRef<(() => void) | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    apiFetch<Status>('/scribe/status').then(setStatus).catch(() => setStatus(null));
    // A visit reopened mid-consultation comes back to what it had.
    return () => stopCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSession = async (withConsent: boolean): Promise<Session> => {
    const session = await apiFetch<Session>('/scribe/sessions', { method: 'POST', data: { appointmentId, consent: withConsent } });
    sessionId.current = session.id;
    return session;
  };

  /** Sends one finished piece. Pieces go one at a time, in order, so the
   *  transcript reads in the order things were said. */
  const send = (blob: Blob, seconds: number) => {
    queue.current = queue.current.then(async () => {
      const id = sessionId.current;
      if (!id) return;
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `piece-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' });
      // Twice more on failure: a clinic's connection drops for a moment
      // far more often than the speech service is really down.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await apiUpload<{ transcript: string; live: Draft | null }>(`/scribe/sessions/${id}/audio`, file, { seconds: String(seconds) });
          setTranscript(res.transcript);
          if (res.live) {
            setDoing(whatChanged(liveRef.current, res.live));
            liveRef.current = res.live;
            setLive(res.live);
          }
          return;
        } catch (e) {
          if (attempt === 2) setError(e instanceof ApiError ? e.message : 'A part of the conversation could not be sent.');
          else await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    });
  };

  const startPiece = () => {
    if (!stream.current || !listening.current) return;
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    const parts: Blob[] = [];
    const startedAt = Date.now();
    pieceStartedAt.current = startedAt;
    heard.current = { speech: 0, total: 0, quiet: 0 };
    rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
    rec.onstop = () => {
      const { speech, total } = heard.current;
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      // Nobody spoke: not sent, not paid for.
      if (total > 0 && speech / total < SPEECH_SHARE) return;
      if (parts.length > 0) send(new Blob(parts, { type: rec.mimeType }), seconds);
    };
    rec.start();
    recorder.current = rec;
    // A new recorder for each piece, rather than one recorder emitting
    // slices: only the first slice of a recording carries the header a
    // player needs, so later slices are not files anyone can transcribe.
    const next = () => {
      if (pieceTimer.current) clearTimeout(pieceTimer.current);
      if (rec.state !== 'inactive') rec.stop();
      startPiece();
    };
    cutHere.current = next;
    pieceTimer.current = setTimeout(next, PIECE_MAX_MS);
  };

  const stopCapture = () => {
    listening.current = false;
    cutHere.current = null;
    if (pieceTimer.current) clearTimeout(pieceTimer.current);
    if (levelTimer.current) clearInterval(levelTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioContext.current?.close().catch(() => {});
    audioContext.current = null;
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  };

  const startListening = async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      await openSession(true);
      stream.current = media;
      listening.current = true;

      // Loudness, sampled five times a second, to know whether a piece
      // had anyone speaking in it.
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(media).connect(analyser);
      audioContext.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      levelTimer.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        const h = heard.current;
        h.total += 1;
        if (Math.sqrt(sum / samples.length) > SPEECH_LEVEL) { h.speech += 1; h.quiet = 0; } else h.quiet += 1;
        // Cut at the pause after something was said, so what was just
        // said is sent now rather than when a timer runs out.
        if (h.quiet === PAUSE_SAMPLES && h.speech >= 5 && Date.now() - pieceStartedAt.current >= PIECE_MIN_MS) cutHere.current?.();
      }, 200);

      // A phone that locks its screen stops recording, mid consultation
      // and without saying so.
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request('screen').catch(() => null)) ?? null;

      setElapsed(0);
      setTranscript('');
      setLive(null);
      liveRef.current = null;
      setDoing('Listening');
      const limit = (status?.maxMinutes ?? 30) * 60;
      tickTimer.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= limit) void finish();
          return s + 1;
        });
      }, 1000);

      setPhase('listening');
      startPiece();
    } catch (e) {
      stopCapture();
      setError(
        e instanceof ApiError ? e.message
          : e instanceof DOMException && e.name === 'NotAllowedError' ? 'This browser was not allowed to use the microphone. Allow it in the address bar and try again.'
          : 'The microphone could not be started.',
      );
    }
  };

  const buildDraft = async () => {
    const id = sessionId.current;
    if (!id) return;
    const res = await apiFetch<{ draft: Draft; transcript: string }>(`/scribe/sessions/${id}/draft`, { method: 'POST', data: {} });
    setNote(res.draft);
    setTranscript(res.transcript);
    setFollowUpDate(res.draft.followUpInDays ? shiftDateInput(todayInput(), res.draft.followUpInDays) : '');
    setPhase('review');
  };

  const finish = async () => {
    if (!listening.current) return;
    setPhase('finishing');
    stopCapture();
    try {
      // The last piece's onstop fires after stop() returns; give it a
      // moment to join the queue, then wait for the queue.
      await new Promise((r) => setTimeout(r, 300));
      await queue.current;
      await buildDraft();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The note could not be made.');
      setPhase('idle');
    }
  };

  const makeFromTyped = async () => {
    setError(null);
    try {
      const session = await openSession(false);
      await apiFetch(`/scribe/sessions/${session.id}/transcript`, { method: 'PUT', data: { transcript: typed } });
      setPhase('finishing');
      await buildDraft();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The note could not be made.');
      setPhase('idle');
    }
  };

  const discard = async () => {
    const id = sessionId.current;
    if (id) await apiFetch(`/scribe/sessions/${id}/discard`, { method: 'POST', data: {} }).catch(() => {});
    sessionId.current = null;
    setNote(null);
    setLive(null);
    liveRef.current = null;
    setTranscript('');
    setTyped('');
    setTyping(false);
    setConsent(false);
    setPhase('idle');
  };

  const confirm = async () => {
    const id = sessionId.current;
    if (!id || !note) return;
    setError(null);
    const incomplete = note.medicines.find((m) => !m.drugName.trim() || !m.dosage.trim() || !m.frequency || !m.duration.trim());
    if (incomplete) {
      setError(`${incomplete.drugName || 'A medicine'} needs a dose, a frequency and a duration before the note can be saved. Fill them in, or remove the line.`);
      return;
    }
    try {
      const res = await apiFetch<{ labTestsSkipped: boolean }>(`/scribe/sessions/${id}/confirm`, {
        method: 'POST',
        data: {
          chiefComplaint: note.chiefComplaint || undefined,
          hopi: note.hopi || undefined,
          diagnosis: note.diagnosis || undefined,
          notes: note.notes || undefined,
          vitals: note.vitals,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : undefined,
          medicines: note.medicines.map((m) => ({
            drugId: m.drugId ?? undefined, drugName: m.drugName.trim(), dosage: m.dosage.trim(),
            frequency: m.frequency, duration: m.duration.trim(), instructions: m.instructions.trim() || undefined,
          })),
          labTests: note.labTests,
        },
      });
      sessionId.current = null;
      setNote(null);
      setPhase('idle');
      setConsent(false);
      setTyped('');
      setTyping(false);
      if (res.labTestsSkipped) setError('The note was saved. The tests were not ordered, because lab orders are not part of this clinic’s plan.');
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The note could not be saved.');
    }
  };

  const patch = (changes: Partial<Draft>) => setNote((n) => (n ? { ...n, ...changes } : n));
  const patchMedicine = (index: number, changes: Partial<DraftMedicine>) =>
    setNote((n) => (n ? { ...n, medicines: n.medicines.map((m, i) => (i === index ? { ...m, ...changes } : m)) } : n));

  if (!status) return null;

  // ── Review ──────────────────────────────────────────────────────────
  if (phase === 'review' && note) {
    const general = note.flags.filter((f) => f.medicine === undefined);
    const input = 'w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary';
    const small = 'px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-primary';
    return (
      <section className="mb-6 p-4 rounded-xl border border-border/15 bg-foreground/[0.03] flex flex-col gap-4" aria-label="The assistant's draft note">
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2"><NotebookPen size={15} /> Draft note</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">Read it through and change anything. Nothing is saved until you confirm.</p>
        </div>

        {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm" role="alert">{error}</div>}
        {general.map((f, i) => (
          <div key={i} className={`px-3 py-2 rounded-lg text-[13px] ${f.level === 'danger' ? 'tone-danger' : f.level === 'warning' ? 'tone-warning' : 'bg-accent/60'}`}>{f.message}</div>
        ))}

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Complaint
          <textarea rows={2} value={note.chiefComplaint} onChange={(e) => patch({ chiefComplaint: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">History
          <textarea rows={3} value={note.hopi} onChange={(e) => patch({ hopi: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {/* Labelled above, not by placeholder: a placeholder vanishes the
              moment a value is filled in, and a draft arrives filled in --
              so "99" and "18" sat side by side with nothing saying which
              was the temperature and which the weight. */}
          {(['bp', 'temp', 'spo2', 'weight', 'pulse'] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ bp: 'BP', temp: 'Temp', spo2: 'SpO2', weight: 'Weight (kg)', pulse: 'Pulse' }[key]}
              <input value={note.vitals[key] ?? ''} onChange={(e) => patch({ vitals: { ...note.vitals, [key]: e.target.value } })} className={`${small} text-foreground`} />
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Diagnosis
          <input value={note.diagnosis} onChange={(e) => patch({ diagnosis: e.target.value })} className={`${input} text-foreground`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Advice and notes
          <textarea rows={2} value={note.notes} onChange={(e) => patch({ notes: e.target.value })} className={`${input} text-foreground`} />
        </label>

        <div>
          <h4 className="text-[13px] font-semibold mb-2">Medicines</h4>
          {note.medicines.length === 0 && <p className="text-[13px] text-muted-foreground">No medicine was heard.</p>}
          <div className="flex flex-col gap-4">
            {note.medicines.map((m, i) => {
              const flags = note.flags.filter((f) => f.medicine === i);
              return (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-start">
                  <input
                    aria-label="Medicine name" value={m.drugName}
                    // Editing the name by hand breaks the link to the
                    // catalogue row: stock is decremented against that
                    // link, so it must only survive an exact pick.
                    onChange={(e) => patchMedicine(i, { drugName: e.target.value, drugId: null, composition: null, match: 'none', approximate: false })}
                    className={`col-span-2 sm:col-span-4 ${small}`}
                  />
                  <DoseInput className="col-span-2 sm:col-span-3" label={`Dose for ${m.drugName}`} value={m.dosage} onChange={(d) => patchMedicine(i, { dosage: d })} />
                  <Pick className="col-span-1 sm:col-span-2" value={m.frequency} placeholder="Frequency" onChange={(f) => patchMedicine(i, { frequency: f })} options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
                  <input aria-label="Duration" placeholder="Duration" value={m.duration} onChange={(e) => patchMedicine(i, { duration: e.target.value })} className={`col-span-1 sm:col-span-2 ${small}`} />
                  <button type="button" onClick={() => patch({ medicines: note.medicines.filter((_, x) => x !== i) })} aria-label={`Remove ${m.drugName}`} className="col-span-2 sm:col-span-1 min-h-[36px] flex items-center justify-center text-muted-foreground/70 hover:text-ink-danger"><Trash2 size={14} /></button>
                  <input aria-label="Instructions" placeholder="Instructions (optional)" value={m.instructions} onChange={(e) => patchMedicine(i, { instructions: e.target.value })} className={`col-span-2 sm:col-span-11 ${small}`} />

                  <div className="col-span-2 sm:col-span-12 flex flex-col gap-1 text-[12px]">
                    {m.composition && <span className="text-muted-foreground">{m.composition}</span>}
                    {m.source && <span className="text-muted-foreground">Heard: “{m.source}”</span>}
                    {m.notes.map((n, x) => <span key={x} className="text-ink-info">{n}</span>)}
                    {flags.map((f, x) => (
                      <span key={x} className={`flex items-start gap-1.5 ${f.level === 'danger' ? 'text-ink-danger font-semibold' : 'text-ink-warning'}`}>
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{f.message}
                      </span>
                    ))}
                    {m.alternatives.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">Or:
                        {m.alternatives.map((a) => (
                          <button type="button" key={a.id} onClick={() => patchMedicine(i, { drugId: a.id, drugName: a.name, composition: a.composition, match: 'catalogue', approximate: false, alternatives: [] })}
                            className="px-2 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/80">{a.name}</button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => patch({ medicines: [...note.medicines, { spoken: '', drugId: null, drugName: '', composition: null, match: 'none', approximate: false, alternatives: [], dosage: '', frequency: 'OD', duration: '', instructions: '', source: '', notes: [] }] })}
            className="mt-3 flex items-center gap-1 text-xs text-ink-success hover:underline"><Plus size={12} /> Add a medicine</button>
        </div>

        {note.labTests.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold mb-2">Tests to order</h4>
            <div className="flex flex-wrap gap-1.5">
              {note.labTests.map((t) => (
                <span key={t} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-foreground/5 text-xs">
                  {t}
                  <button type="button" onClick={() => patch({ labTests: note.labTests.filter((x) => x !== t) })} aria-label={`Do not order ${t}`} className="p-1 rounded hover:bg-foreground/10"><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Follow-up date</label>
          <DatePicker value={followUpDate} onChange={setFollowUpDate} label="Follow-up date" placeholder="No follow-up" min={todayInput()} clearable />
        </div>

        {note.leftover.length > 0 && (
          <div className="rounded-lg border border-border/15 p-3">
            <h4 className="text-[13px] font-semibold">Said, but not placed in the note</h4>
            <p className="text-[12px] text-muted-foreground mb-2">Check nothing here should be in it.</p>
            <ul className="flex flex-col gap-1.5">
              {note.leftover.map((line, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-[13px]">
                  <span>{line}</span>
                  <button type="button" onClick={() => patch({ notes: note.notes ? `${note.notes}\n${line}` : line, leftover: note.leftover.filter((_, x) => x !== i) })}
                    className="shrink-0 text-xs text-ink-success hover:underline">Add to notes</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <button type="button" onClick={() => setShowHeard((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2" aria-expanded={showHeard}>
            {showHeard ? 'Hide what was heard' : 'Show everything that was heard'}
          </button>
          {showHeard && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-foreground/5 p-3 text-[13px] text-foreground/80">{transcript}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={confirm} busyLabel="Saving…">Confirm and save</Button>
          <Button variant="ghost" onClick={discard}>Discard</Button>
          <span className="text-[12px] text-muted-foreground">{note.engine.reason}</span>
        </div>
      </section>
    );
  }

  // ── Listening ───────────────────────────────────────────────────────
  if (phase === 'listening' || phase === 'finishing') {
    return (
      <section className="mb-6 p-4 rounded-xl border border-ink-danger/30 bg-ink-danger/5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold">
            {phase === 'listening'
              ? <><span className="h-2.5 w-2.5 rounded-full bg-ink-danger animate-pulse" aria-hidden="true" /> Listening · {clock(elapsed)}</>
              : 'Reading it through once more…'}
          </div>
          {phase === 'listening' && <Button variant="danger" icon={<Square size={13} />} onClick={finish}>Stop and check the note</Button>}
        </div>
        {/* What it is doing this moment, in words. */}
        {phase === 'listening' && <p className="mt-1 text-[13px] text-muted-foreground">{doing}</p>}
        {error && <div className="mt-3 px-3 py-2 rounded-lg tone-warning text-sm">{error}</div>}
        <LiveNote note={live} />
        {transcript && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            <span className="font-medium">Just heard: </span>
            {/* The end of it: the newest words are the ones worth showing. */}
            {transcript.length > 220 ? `…${transcript.slice(-220)}` : transcript}
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
        {status.canListen
          ? 'It listens while you talk to the patient, then fills in the note and prescription for you to check.'
          : 'Type or paste your notes in any order, and it will sort them into the note and prescription for you to check.'}
      </p>
      {error && <div className="mt-3 px-3 py-2 rounded-lg tone-danger text-sm" role="alert">{error}</div>}

      {status.canListen && !typing && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>The patient has agreed to this consultation being recorded to write their notes. The recording itself is not kept.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Mic size={14} />} disabled={!consent} onClick={startListening}>Start listening</Button>
            <button type="button" onClick={() => setTyping(true)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Type or paste instead</button>
          </div>
        </div>
      )}

      {(typing || !status.canListen) && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            rows={5} value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="Complaint fever three days. BP 120 by 80. Diagnosis viral fever. Tab Dolo 650 thrice a day for 3 days after food. Do a CBC. Review after 5 days."
            className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<NotebookPen size={14} />} disabled={typed.trim().length < 10} onClick={makeFromTyped}>Make the note</Button>
            {status.canListen && <button type="button" onClick={() => setTyping(false)} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Listen instead</button>}
          </div>
        </div>
      )}
    </section>
  );
}
