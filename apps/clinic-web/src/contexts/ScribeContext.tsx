import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiFetch, apiUpload, ApiError } from '../lib/api';
import { useClinicAuth } from './ClinicAuthContext';
import { shiftDateInput, todayInput } from '../lib/date';

/**
 * The clinic assistant's recorder, held above the screens.
 *
 * ── Why it is not inside the visit screen ────────────────────────────
 *
 * It used to be. The microphone, the timers and the note being written
 * all belonged to the panel on the visit page, so the moment a doctor
 * left that page -- to look at the patient's history, an old report, the
 * last prescription -- the panel was taken down and the recording with
 * it. A doctor mid-consultation looks things up constantly; an assistant
 * that stops listening when they do is not one they can use.
 *
 * So the recorder lives here, in the portal's shell, which is on screen
 * for the whole session. The visit page shows it; a small bar shows it
 * everywhere else (components/ScribeDock.tsx); neither owns it.
 *
 * ── How the audio travels ────────────────────────────────────────────
 *
 * In short pieces, each a complete recording of its own, sent as it ends
 * -- and it ends at a pause. Somebody finishes a sentence and draws
 * breath; that is where the piece is cut, so no word is split in two and
 * what was just said is on its way within a second of being said. The
 * note is rebuilt from every piece, which is what makes it fill in while
 * the doctor is still talking.
 *
 * A piece in which nobody spoke is never sent: it would cost money to be
 * told it was silent.
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
/**
 * Loudness above which a moment counts as somebody speaking.
 *
 * Not a fixed number: a patient across a desk from a tablet is far
 * quieter than a doctor leaning over it, and a fixed bar set for the
 * doctor's voice called the patient's half of the conversation silence
 * and never sent it. The bar is set from the room instead -- a multiple
 * of the quietest level heard so far -- with a floor so that a silent
 * room does not make its own hum count as speech.
 */
const SPEECH_FLOOR = 0.008;
const SPEECH_OVER_ROOM = 2.5;

export interface Candidate { id: string; name: string; composition: string | null }
export interface DraftMedicine {
  spoken: string; drugId: string | null; drugName: string; composition: string | null;
  match: 'habit' | 'catalogue' | 'none'; approximate: boolean; alternatives: Candidate[];
  dosage: string; frequency: string; duration: string; instructions: string; source: string; notes: string[];
}
export interface Flag { level: 'danger' | 'warning' | 'info'; kind: string; message: string; medicine?: number }
export interface Draft {
  chiefComplaint: string; hopi: string; diagnosis: string; notes: string;
  vitals: { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string };
  medicines: DraftMedicine[]; labTests: string[]; followUpInDays: number | null;
  flags: Flag[]; leftover: string[]; engine: { model: string | null; reason: string };
}
export interface ScribeStatus { canListen: boolean; canSummarise: boolean; maxMinutes: number }
export type ScribePhase = 'idle' | 'listening' | 'finishing' | 'review';

interface ScribeValue {
  /** Null when the assistant is not part of this clinic's plan, or the
   *  person signed in is not a doctor. */
  status: ScribeStatus | null;
  phase: ScribePhase;
  /** The visit the assistant is working on, when it is working. */
  appointmentId: string | null;
  patientName: string;
  elapsed: number;
  /** Seconds of the visit that had speech in them and were sent. */
  sentSeconds: number;
  transcript: string;
  /** The note as it stands while still listening. */
  live: Draft | null;
  /** What it is doing this moment, in words. */
  doing: string;
  error: string | null;
  /** The note once listening has stopped: the doctor's to edit. */
  note: Draft | null;
  followUpDate: string;
  setFollowUpDate: (iso: string) => void;
  patchNote: (changes: Partial<Draft>) => void;
  patchMedicine: (index: number, changes: Partial<DraftMedicine>) => void;
  removeMedicine: (index: number) => void;
  start: (appointmentId: string, patientName: string) => Promise<void>;
  finish: () => Promise<void>;
  makeFromTyped: (appointmentId: string, patientName: string, text: string) => Promise<void>;
  discard: () => Promise<void>;
  /** True when the visit's records were written. */
  confirm: () => Promise<boolean>;
  /** The medicine that stopped a save, so the screen can point at it. */
  incomplete: number | null;
}

const ScribeContext = createContext<ScribeValue | null>(null);

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
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

export function ScribeProvider({ children }: { children: ReactNode }) {
  const { hasModule, canWriteClinical } = useClinicAuth();
  const enabled = hasModule('scribe') && canWriteClinical;

  const [status, setStatus] = useState<ScribeStatus | null>(null);
  const [phase, setPhase] = useState<ScribePhase>('idle');
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [sentSeconds, setSentSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [live, setLive] = useState<Draft | null>(null);
  const [doing, setDoing] = useState('Listening');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Draft | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [incomplete, setIncomplete] = useState<number | null>(null);

  // Everything the recorder touches lives in refs: it runs on timers and
  // media callbacks that must see the current value, not the one from the
  // render they were created in.
  const sessionId = useRef<string | null>(null);
  const liveRef = useRef<Draft | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const listening = useRef(false);
  const pieceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heard = useRef({ speech: 0, total: 0, quiet: 0 });
  /** The quietest the room has been: what silence sounds like here. */
  const room = useRef(1);
  const pieceStartedAt = useRef(0);
  /** Ends the piece being recorded now and starts the next one. */
  const cutHere = useRef<(() => void) | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const finishRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!enabled) { setStatus(null); return; }
    apiFetch<ScribeStatus>('/scribe/status').then(setStatus).catch(() => setStatus(null));
  }, [enabled]);

  const stopCapture = useCallback(() => {
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
  }, []);

  // Signing out, or closing the portal, ends it. Moving between screens
  // does not: that is the whole point of holding it here.
  useEffect(() => stopCapture, [stopCapture]);

  // Closing the tab mid-consultation would lose the part not yet sent.
  useEffect(() => {
    if (phase !== 'listening') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const reset = () => {
    sessionId.current = null;
    liveRef.current = null;
    setAppointmentId(null);
    setPatientName('');
    setNote(null);
    setLive(null);
    setTranscript('');
    setFollowUpDate('');
    setIncomplete(null);
    setPhase('idle');
  };

  const openSession = async (forAppointment: string, withConsent: boolean) => {
    const session = await apiFetch<{ id: string }>('/scribe/sessions', { method: 'POST', data: { appointmentId: forAppointment, consent: withConsent } });
    sessionId.current = session.id;
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
      if (parts.length > 0) {
        setSentSeconds((s) => s + seconds);
        send(new Blob(parts, { type: rec.mimeType }), seconds);
      }
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

  const buildDraft = async () => {
    const id = sessionId.current;
    if (!id) return;
    const res = await apiFetch<{ draft: Draft; transcript: string }>(`/scribe/sessions/${id}/draft`, { method: 'POST', data: {} });
    setNote(res.draft);
    setTranscript(res.transcript);
    setFollowUpDate(res.draft.followUpInDays ? shiftDateInput(todayInput(), res.draft.followUpInDays) : '');
    setIncomplete(null);
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
      reset();
    }
  };
  finishRef.current = finish;

  const start = async (forAppointment: string, forPatient: string) => {
    if (phase !== 'idle') return;
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      await openSession(forAppointment, true);
      stream.current = media;
      listening.current = true;
      setAppointmentId(forAppointment);
      setPatientName(forPatient);

      // Loudness, sampled five times a second, to know whether a piece
      // had anyone speaking in it and where the pauses are.
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(media).connect(analyser);
      audioContext.current = context;
      const samples = new Uint8Array(analyser.fftSize);
      room.current = 1;
      levelTimer.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        const level = Math.sqrt(sum / samples.length);
        // Drifts up slowly, so a room that gets noisier is learned too.
        room.current = Math.min(level > 0 ? level : room.current, room.current * 1.002);
        const h = heard.current;
        h.total += 1;
        if (level > Math.max(SPEECH_FLOOR, room.current * SPEECH_OVER_ROOM)) { h.speech += 1; h.quiet = 0; } else h.quiet += 1;
        // Cut at the pause after something was said, so what was just
        // said is sent now rather than when a timer runs out.
        if (h.quiet === PAUSE_SAMPLES && h.speech >= 5 && Date.now() - pieceStartedAt.current >= PIECE_MIN_MS) cutHere.current?.();
      }, 200);

      // A phone that locks its screen stops recording, mid consultation
      // and without saying so.
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request('screen').catch(() => null)) ?? null;

      setElapsed(0);
      setSentSeconds(0);
      setTranscript('');
      setLive(null);
      liveRef.current = null;
      setDoing('Listening');
      const limit = (status?.maxMinutes ?? 30) * 60;
      tickTimer.current = setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= limit) void finishRef.current();
          return s + 1;
        });
      }, 1000);

      setPhase('listening');
      startPiece();
    } catch (e) {
      stopCapture();
      reset();
      setError(
        e instanceof ApiError ? e.message
          : e instanceof DOMException && e.name === 'NotAllowedError' ? 'This browser was not allowed to use the microphone. Allow it in the address bar and try again.'
          : 'The microphone could not be started.',
      );
    }
  };

  const makeFromTyped = async (forAppointment: string, forPatient: string, text: string) => {
    if (phase !== 'idle') return;
    setError(null);
    try {
      await openSession(forAppointment, false);
      setAppointmentId(forAppointment);
      setPatientName(forPatient);
      await apiFetch(`/scribe/sessions/${sessionId.current}/transcript`, { method: 'PUT', data: { transcript: text } });
      setPhase('finishing');
      await buildDraft();
    } catch (e) {
      reset();
      setError(e instanceof ApiError ? e.message : 'The note could not be made.');
    }
  };

  const discard = async () => {
    const id = sessionId.current;
    stopCapture();
    if (id) await apiFetch(`/scribe/sessions/${id}/discard`, { method: 'POST', data: {} }).catch(() => {});
    setError(null);
    reset();
  };

  const confirm = async (): Promise<boolean> => {
    const id = sessionId.current;
    if (!id || !note) return false;
    setError(null);
    const missing = note.medicines.findIndex((m) => !m.drugName.trim() || !m.dosage.trim() || !m.frequency || !m.duration.trim());
    setIncomplete(missing >= 0 ? missing : null);
    if (missing >= 0) {
      const m = note.medicines[missing]!;
      const need = [!m.drugName.trim() && 'a name', !m.dosage.trim() && 'a dose', !m.frequency && 'a frequency', !m.duration.trim() && 'a duration'].filter(Boolean).join(' and ');
      setError(`Not saved yet: ${m.drugName.trim() || 'one medicine'} still needs ${need}. Fill it in, or remove that line.`);
      return false;
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
      reset();
      if (res.labTestsSkipped) setError('The note was saved. The tests were not ordered, because lab orders are not part of this clinic’s plan.');
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The note could not be saved.');
      return false;
    }
  };

  const patchNote = (changes: Partial<Draft>) => setNote((n) => (n ? { ...n, ...changes } : n));

  /**
   * A change to one medicine line.
   *
   * What the assistant said about a line was said about the medicine it
   * heard. Once the doctor types a different name over it, those remarks
   * are about something that is no longer there -- "Albumin: not found"
   * under a line that now reads "Dolo" -- so they go when the name does.
   */
  const patchMedicine = (index: number, changes: Partial<DraftMedicine>) =>
    setNote((n) => {
      if (!n) return n;
      const renamed = changes.drugName !== undefined && changes.drugName !== n.medicines[index]?.drugName;
      return {
        ...n,
        medicines: n.medicines.map((m, i) => (i === index ? { ...m, ...changes, ...(renamed ? { notes: [], source: changes.source ?? '', alternatives: changes.alternatives ?? [] } : {}) } : m)),
        flags: renamed ? n.flags.filter((f) => f.medicine !== index) : n.flags,
      };
    });

  /** Removes a line, and keeps every remark pointing at the line it was about. */
  const removeMedicine = (index: number) =>
    setNote((n) => n && {
      ...n,
      medicines: n.medicines.filter((_, i) => i !== index),
      flags: n.flags
        .filter((f) => f.medicine !== index)
        .map((f) => (f.medicine !== undefined && f.medicine > index ? { ...f, medicine: f.medicine - 1 } : f)),
    });

  return (
    <ScribeContext.Provider
      value={{
        status, phase, appointmentId, patientName, elapsed, sentSeconds, transcript, live, doing, error,
        note, followUpDate, setFollowUpDate, patchNote, patchMedicine, removeMedicine,
        start, finish, makeFromTyped, discard, confirm, incomplete,
      }}
    >
      {children}
    </ScribeContext.Provider>
  );
}

export function useScribe(): ScribeValue {
  const value = useContext(ScribeContext);
  if (!value) throw new Error('useScribe must be used inside ScribeProvider');
  return value;
}

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
