import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mic, Square, CornerDownLeft, X, Check } from 'lucide-react';
import { apiFetch, apiUpload, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { useScribe } from '../contexts/ScribeContext';
import { ScribeStatusRow } from './ScribeDock';
import { Button } from './Button';

/**
 * The assistant, on every screen.
 *
 * One line at the bottom of the portal. Somebody types what they want, or
 * taps the microphone and says it -- "open Fatima Sayyed", "show her last
 * prescription", "who is next", "note Ramesh Joshi's BP as 140 by 90" --
 * and the app does it. They do not need to know where anything is.
 *
 * ── What it does with a request ──────────────────────────────────────
 *
 * Sends the words, and which screen they were said on, to the clinic's
 * own API. That works out which of the app's actions was meant (by rule
 * when it can, by a language model when it must) and runs it with the
 * asker's own permissions. See apps/clinic-api/src/lib/assistant/.
 *
 *   a lookup   comes back as a short answer, each line a link into the app
 *   a screen   is opened, and a line says what was opened
 *   a change   comes back as a card saying exactly what will be done, and
 *              is made when the person says yes, presses Enter or taps
 *              Confirm
 *
 * ── The microphone ───────────────────────────────────────────────────
 *
 * Tapped, it stays on the line like a phone call until it is tapped
 * again. Each thing said is sent at the pause after it, so one
 * instruction is being carried out while the next is being spoken. Held
 * down, it hears one instruction and lets go with the finger.
 *
 * It does not listen all day. Silence is never sent, a call nobody
 * speaks on hangs up after 25 seconds, and none runs past five minutes:
 * an assistant that waited all day for its name would send a speech
 * service hours of waiting-room chatter, and the clinic would pay for it.
 */

interface Line { label?: string; text: string; to?: string; tone?: 'danger' | 'warning' | 'muted' }
type Reply =
  | { kind: 'answer'; title: string; lines: Line[]; to?: string; toLabel?: string }
  | { kind: 'go'; to: string; say: string }
  | { kind: 'confirm'; action: string; params: Record<string, unknown>; title: string; lines: Line[]; patientId: string | null; appointmentId: string | null; seal: string }
  | { kind: 'done'; say: string; to?: string }
  | { kind: 'sorry'; say: string };

interface Asked {
  reply: Reply;
  /** What else was asked for in the same breath: "order a CBC and book
   *  him after a week" is two things, and each gets its own card. */
  more?: Reply[];
  heard?: string;
  by?: 'rule' | 'model' | 'none';
  request?: string;
}
type Card = Extract<Reply, { kind: 'confirm' }>;
/** The first card still waiting for a yes, and where it sits (-1: the main reply). */
function waitingCard(asked: Asked | null): { card: Card; at: number } | null {
  if (!asked) return null;
  if (asked.reply.kind === 'confirm') return { card: asked.reply, at: -1 };
  const at = (asked.more ?? []).findIndex((r) => r.kind === 'confirm');
  return at >= 0 ? { card: asked.more![at] as Card, at } : null;
}
/** What the server sends back: an answer, or which way a waiting card was decided. */
type FromServer = Asked | { decided: 'yes' | 'no'; heard?: string };

/**
 * A question the assistant asked back, which the next thing said answers.
 *
 * "Give him sick leave" -- "For how many days?" -- "Three." The last of
 * those means nothing by itself, so it is sent with the two before it.
 * Only one exchange deep: this is a request being completed, not a chat.
 */
function pendingFrom(asked: Asked | null): { request: string; question: string } | undefined {
  if (!asked?.request || asked.by !== 'model' || asked.reply.kind !== 'sorry') return undefined;
  return asked.reply.say.trim().endsWith('?') ? { request: asked.request, question: asked.reply.say } : undefined;
}

/** The patient and the visit on screen, read from the address. */
function onScreen(pathname: string): { patientId?: string; appointmentId?: string } {
  const visit = /^\/appointments\/([^/]+)\/encounter/.exec(pathname);
  if (visit) return { appointmentId: visit[1] };
  const patient = /^\/patients\/([^/]+)/.exec(pathname);
  if (patient) return { patientId: patient[1] };
  return {};
}

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/**
 * A few things worth asking, offered when the line is empty.
 *
 * Somebody who has never used the app does not know what it can be asked.
 * These are the everyday ones, each answered by rule: tapping one costs
 * nothing and shows what kind of thing to ask next.
 */
const ON_A_PATIENT = ['Summary', 'Last prescription', 'Lab reports', 'BP trend', 'Past visits'];
const ANYWHERE = ['Who is next', 'Call the next patient', 'What needs attention', 'Follow-ups due', "Today's collection"];

/** One instruction is cut off here even if the speaker never paused. */
const MAX_PIECE_MS = 18_000;
/** Nothing said for this long, and the call hangs itself up. */
const HANG_UP_AFTER_MS = 25_000;
/** However busy the doctor, a call to the assistant ends here. */
const MAX_CALL_MS = 5 * 60_000;
/** This long without a word, after some were said, and the request is over. */
const QUIET_ENDS_MS = 1_300;
/** Down for longer than this is a hold; shorter is a tap. */
const HOLD_MS = 500;
/** How long "Opening the queue." stays up after the screen has changed. */
const NOTE_MS = 4_500;

export function AssistantBar() {
  const { hasModule } = useClinicAuth();
  const scribe = useScribe();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [text, setText] = useState('');
  const [asked, setAsked] = useState<Asked | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  /** Pieces of speech sent and not yet answered. */
  const [working, setWorking] = useState(0);
  /** How loud the room is, 0 to 1, so the button shows it is hearing. */
  const [level, setLevel] = useState(0);
  const [canHear, setCanHear] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  /** Everything to undo when listening ends: timers, the level meter. */
  const cleanup = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  // The recorder's callback outlives the render it was made in.
  const askedRef = useRef<Asked | null>(null);
  askedRef.current = asked;
  /** Listening has been asked for. The microphone takes a moment to open,
   *  and by then it may already have been asked to stop. */
  const wanted = useRef(false);
  const downAt = useRef(0);
  const startedByThisPress = useRef(false);

  // A card says "do this for this patient". Once another screen is open
  // it goes: it is never left showing over a different patient with a
  // Confirm on it. (The server would refuse it anyway; see seal.ts.)
  useEffect(() => {
    setAsked((current) => (current?.reply.kind === 'confirm' ? null : current));
  }, [pathname]);

  // "Opening Fatima Sayyed's visit." has done its work once it is read.
  useEffect(() => {
    if (asked?.reply.kind !== 'go' || (asked.more ?? []).length > 0) return;
    const timer = setTimeout(() => setAsked((current) => (current === asked ? null : current)), NOTE_MS);
    return () => clearTimeout(timer);
  }, [asked]);

  // Leaving the portal, or the bar being taken down, lets go of the
  // microphone whatever state it was in.
  useEffect(() => () => {
    cancelled.current = true;
    wanted.current = false;
    cleanup.current?.();
  }, []);

  const enabled = hasModule('scribe');

  useEffect(() => {
    if (!enabled) return;
    apiFetch<{ canHear: boolean }>('/assistant/status').then((s) => setCanHear(s.canHear)).catch(() => setCanHear(false));
  }, [enabled]);

  // "/" from anywhere that is not a text field puts the cursor here, the
  // way it does in most tools people already use.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') {
        if (wanted.current) stopListening(true);
        else if (asked) setAsked(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, asked]);

  if (!enabled) return null;

  const fail = (e: unknown) => setAsked({ reply: { kind: 'sorry', say: e instanceof ApiError ? e.message : 'The assistant could not be reached. Try again in a moment.' } });

  const confirm = async (reply: Card, at = -1) => {
    setBusy(true);
    try {
      // The patient and visit the card was drawn up for, with its seal --
      // not whoever is on screen at the moment of the tap.
      const result = await apiFetch<Asked>('/assistant/run', {
        method: 'POST',
        data: { action: reply.action, params: reply.params, patientId: reply.patientId, appointmentId: reply.appointmentId, seal: reply.seal },
      });
      // Only the card that was confirmed changes; the others stay as they are.
      setAsked((current) => {
        if (!current || (at < 0 && !(current.more ?? []).length)) return result;
        return at < 0 ? { ...current, reply: result.reply } : { ...current, more: (current.more ?? []).map((r, i) => (i === at ? result.reply : r)) };
      });
      // What is on screen may have just changed underneath it.
      window.dispatchEvent(new CustomEvent('assistant:changed'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** What came back, put on screen and acted on. */
  const show = async (result: FromServer, request: string | undefined, onCall = false) => {
    if ('decided' in result) {
      // A yes or a no, to the card that was waiting when it was said.
      const waiting = waitingCard(askedRef.current);
      if (!waiting) return;
      if (result.decided === 'yes') await confirm(waiting.card, waiting.at);
      else setAsked(null);
      return;
    }
    // On a call, one instruction follows another. A card still waiting
    // for its yes is not swept away by the next thing said: the new
    // answer goes under it.
    const before = askedRef.current;
    if (onCall && before && waitingCard(before)) {
      const next: Asked = { ...before, heard: result.heard ?? before.heard, more: [...(before.more ?? []), result.reply, ...(result.more ?? [])] };
      askedRef.current = next;
      setAsked(next);
    } else {
      const next: Asked = { ...result, request };
      askedRef.current = next;
      setAsked(next);
    }
    if (result.reply.kind === 'go') navigate(result.reply.to);
  };

  const ask = async (words: string) => {
    const request = words.trim();
    if (!request || busy) return;
    setBusy(true);
    try {
      const result = await apiFetch<FromServer>('/assistant/ask', {
        method: 'POST',
        data: { text: request, ...onScreen(pathname), screen: pathname, card: waitingCard(asked) !== null, pending: pendingFrom(asked) },
      });
      setText('');
      setBusy(false);
      await show(result, request);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // ── The microphone: on call until hung up ────────────────────────────
  //
  // Tapped, it stays listening the way somebody on a phone call does,
  // until it is tapped again. Each thing said is cut off at the pause
  // after it and sent on its own, so the first instruction is being
  // carried out while the second is still being spoken. Nothing is sent
  // while nobody is talking, and a call nobody is speaking on hangs
  // itself up.
  const stopListening = (cancel = false) => {
    wanted.current = false;
    if (cancel) cancelled.current = true;
    cleanup.current?.();
    cleanup.current = null;
  };

  const startListening = async () => {
    if (listening || wanted.current) return;
    wanted.current = true;
    cancelled.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch {
      wanted.current = false;
      setAsked({ reply: { kind: 'sorry', say: 'This browser was not allowed to use the microphone. Allow it in the address bar, or type what you need.' } });
      return;
    }
    // Asked to stop while the microphone was still opening.
    if (!wanted.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = pickMimeType();
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audio = AudioCtx ? new AudioCtx() : null;
    const analyser = audio?.createAnalyser() ?? null;
    if (audio && analyser) {
      analyser.fftSize = 1024;
      audio.createMediaStreamSource(stream).connect(analyser);
    }
    const samples = new Float32Array(analyser?.fftSize ?? 0);
    const callStartedAt = Date.now();
    let quiet = 0.01;
    let loudFrames = 0;
    let lastSpeechAt = callStartedAt;
    let over = false;

    // What was said goes out one piece at a time and in the order it was
    // said: "open Vikram More" must have opened him before "record his
    // pulse" is read.
    let sending: Promise<void> = Promise.resolve();
    const send = (blob: Blob) => {
      setWorking((n) => n + 1);
      sending = sending.then(async () => {
        try {
          const here = window.location.pathname;
          const context = onScreen(here);
          const fields: Record<string, string> = { screen: here };
          if (context.patientId) fields.patientId = context.patientId;
          if (context.appointmentId) fields.appointmentId = context.appointmentId;
          if (waitingCard(askedRef.current)) fields.card = '1';
          const pending = pendingFrom(askedRef.current);
          if (pending) { fields.pendingRequest = pending.request; fields.pendingQuestion = pending.question; }
          const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
          const result = await apiUpload<FromServer>('/assistant/voice', new File([blob], `ask-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' }), fields);
          // A cough, a door, the patient's own remark: nothing to act on,
          // and nothing to interrupt the doctor with either.
          if (!('decided' in result) && result.heard !== undefined && result.heard.trim().length < 2) return;
          await show(result, result.heard, true);
        } catch (e) {
          fail(e);
        } finally {
          setWorking((n) => Math.max(0, n - 1));
        }
      });
    };

    // One piece: from the first word of an instruction to the pause after it.
    let rec: MediaRecorder | null = null;
    let parts: Blob[] = [];
    let spoke = false;
    let pieceStartedAt = 0;
    const beginPiece = () => {
      parts = [];
      spoke = false;
      pieceStartedAt = Date.now();
      const mine: Blob[] = parts;
      const r = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      r.ondataavailable = (e) => { if (e.data.size > 0) mine.push(e.data); };
      r.start();
      rec = r;
      recorder.current = r;
    };
    const endPiece = (keep: boolean) => {
      const r = rec;
      if (!r || r.state === 'inactive') return;
      const mine = parts;
      const had = spoke || !analyser;
      r.onstop = () => { if (keep && had && !cancelled.current && mine.length > 0) send(new Blob(mine, { type: r.mimeType })); };
      r.stop();
      rec = null;
    };

    const hangUp = () => {
      if (over) return;
      over = true;
      clearInterval(meter);
      clearTimeout(limit);
      endPiece(true);
      stream.getTracks().forEach((track) => track.stop());
      void audio?.close().catch(() => undefined);
      wanted.current = false;
      cleanup.current = null;
      setLevel(0);
      setListening(false);
    };

    const meter = setInterval(() => {
      const now = Date.now();
      let loudness = 0;
      if (analyser) {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        loudness = Math.sqrt(sum / samples.length);
        // Capped: somebody who starts talking the instant they tap must
        // not have their own voice taken for the room's quiet.
        if (now - callStartedAt < 300) quiet = Math.min(0.02, Math.max(quiet, loudness * 1.2));
        setLevel(Math.min(1, loudness / 0.15));
      }
      const held = startedByThisPress.current && downAt.current > 0;
      if (analyser && loudness > Math.max(0.02, quiet * 2.5)) {
        loudFrames += 1;
        if (loudFrames >= 2) { spoke = true; lastSpeechAt = now; }
        // Somebody who does not pause is still cut, mid-breath if need be,
        // so that what they said first is not kept waiting on the rest.
        if (now - pieceStartedAt > MAX_PIECE_MS) { endPiece(true); beginPiece(); }
        return;
      }
      loudFrames = 0;
      // Held down, it is one instruction, ended by the finger lifting.
      if (held) return;
      if (spoke && now - lastSpeechAt > QUIET_ENDS_MS) { endPiece(true); beginPiece(); return; }
      // A piece with nothing in it is thrown away before it grows.
      if (!spoke && now - pieceStartedAt > 6_000) { endPiece(false); beginPiece(); }
      // Nobody has spoken for a while: the call is over.
      if (now - lastSpeechAt > HANG_UP_AFTER_MS) hangUp();
    }, 60);
    const limit = setTimeout(hangUp, MAX_CALL_MS);
    cleanup.current = hangUp;

    beginPiece();
    setListening(true);
  };

  // A consultation is using the microphone to write a note. A request
  // spoken now would be written into that note as something the doctor
  // said to the patient, so while it listens, requests are typed.
  const recordingVisit = scribe.phase === 'listening';
  const onVisit = Boolean(onScreen(pathname).appointmentId);
  const reply = asked?.reply;
  const waiting = waitingCard(asked);
  const tone = (line: Line) => (line.tone === 'danger' ? 'text-ink-danger font-semibold' : line.tone === 'warning' ? 'text-ink-warning' : line.tone === 'muted' ? 'text-muted-foreground' : '');
  const micLabel = recordingVisit
    ? 'The microphone is writing a visit note. Type your request.'
    : listening ? 'Listening. Tap to stop.' : 'Tap, say what you need, and tap again when you are done';

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl md:left-[calc(15rem+0.75rem)] print:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* ── What it answered ─────────────────────────────────────────── */}
      {reply && (
        <div className="mb-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-border/20 bg-background p-4 shadow-overlay" role="status" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {asked?.heard && <p className="mb-1 text-[12px] text-muted-foreground">You said: “{asked.heard}”</p>}
              {(reply.kind === 'answer' || reply.kind === 'confirm') && <h3 className="text-[15px] font-semibold">{reply.title}</h3>}
              {(reply.kind === 'sorry' || reply.kind === 'done') && <p className="text-[14px]">{reply.say}</p>}
              {reply.kind === 'go' && <p className="flex items-center gap-1.5 text-[14px] font-medium"><Check size={14} className="shrink-0 text-ink-success" aria-hidden="true" /> {reply.say}</p>}
            </div>
            <button type="button" onClick={() => setAsked(null)} aria-label="Close" className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-foreground/10"><X size={16} /></button>
          </div>

          {(reply.kind === 'answer' || reply.kind === 'confirm') && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {reply.lines.map((line, i) => (
                <li key={i} className={`flex gap-3 text-[14px] leading-relaxed ${tone(line)}`}>
                  {line.label && <span className="w-24 shrink-0 text-[12px] font-medium text-muted-foreground pt-0.5 sm:w-28">{line.label}</span>}
                  {line.to
                    ? <Link to={line.to} onClick={() => setAsked(null)} className="min-w-0 flex-1 underline decoration-border underline-offset-2 hover:decoration-foreground">{line.text}</Link>
                    : <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text}</span>}
                </li>
              ))}
            </ul>
          )}

          {reply.kind === 'answer' && reply.to && (
            <Link to={reply.to} onClick={() => setAsked(null)} className="mt-3 inline-block text-[13px] font-semibold text-ink-success hover:underline">{reply.toLabel ?? 'Open it'} →</Link>
          )}
          {reply.kind === 'done' && reply.to && (
            <Link to={reply.to} onClick={() => setAsked(null)} className="mt-2 inline-block text-[13px] font-semibold text-ink-success hover:underline">Open it →</Link>
          )}
          {reply.kind === 'confirm' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={<Check size={14} />} busy={busy} busyLabel="Doing it…" onClick={() => confirm(reply)}>Confirm</Button>
              <Button variant="ghost" onClick={() => setAsked(null)}>Cancel</Button>
              <span className="text-[12px] text-muted-foreground">Nothing has been changed yet. Say “yes”, press Enter, or tap Confirm.</span>
            </div>
          )}
          {(asked?.more ?? []).map((extra, i) => (
            <div key={i} className="mt-3 border-t border-border/15 pt-3">
              {(extra.kind === 'answer' || extra.kind === 'confirm') && <h3 className="text-[15px] font-semibold">{extra.title}</h3>}
              {(extra.kind === 'sorry' || extra.kind === 'done' || extra.kind === 'go') && <p className="text-[14px]">{extra.kind === 'go' ? `${extra.say.replace(/^Opening /, 'Also asked for: ').replace(/\.$/, '')}. Ask again to open it.` : extra.say}</p>}
              {(extra.kind === 'answer' || extra.kind === 'confirm') && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {extra.lines.map((line, x) => (
                    <li key={x} className={`flex gap-3 text-[14px] leading-relaxed ${tone(line)}`}>
                      {line.label && <span className="w-24 shrink-0 text-[12px] font-medium text-muted-foreground pt-0.5 sm:w-28">{line.label}</span>}
                      <span className="min-w-0 flex-1 whitespace-pre-wrap">{line.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {extra.kind === 'confirm' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="primary" icon={<Check size={14} />} busyLabel="Doing it…" onClick={() => confirm(extra, i)}>Confirm</Button>
                  <span className="text-[12px] text-muted-foreground">Nothing has been changed yet.</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Things to ask, while the line is empty and in use ────────── */}
      {focused && !text && !reply && !busy && !listening && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Things you can ask">
          {(onScreen(pathname).appointmentId || onScreen(pathname).patientId ? ON_A_PATIENT : ANYWHERE).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              // Before the input loses focus, or the row is gone by the
              // time the tap lands on it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void ask(suggestion)}
              className="rounded-full border border-border/20 bg-background px-3 py-1.5 text-[13px] font-medium shadow-overlay hover:bg-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* ── The bar ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/20 bg-background shadow-overlay">
        <ScribeStatusRow />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Enter on an empty line, with a card waiting, is a yes to it.
            if (!text.trim() && waiting) void confirm(waiting.card, waiting.at);
            else void ask(text);
          }}
          className="flex items-center gap-2 px-2 py-2"
        >
          {canHear && (
            <button
              type="button"
              disabled={recordingVisit || (busy && !listening)}
              onPointerDown={(e) => {
                e.preventDefault();
                // The finger may slide off the button while it is held;
                // the lift must still be heard here.
                e.currentTarget.setPointerCapture(e.pointerId);
                downAt.current = Date.now();
                // Already listening: this press is the one that ends it.
                startedByThisPress.current = !wanted.current;
                if (startedByThisPress.current) void startListening();
              }}
              onPointerUp={() => {
                const heldFor = Date.now() - downAt.current;
                downAt.current = 0;
                // A second tap hangs up; so does letting go after holding.
                // The first tap only starts the call.
                if (!startedByThisPress.current || heldFor >= HOLD_MS) stopListening();
                startedByThisPress.current = false;
              }}
              onPointerCancel={() => { downAt.current = 0; startedByThisPress.current = false; }}
              // From the keyboard there is no press to time: Space or Enter
              // starts it, and again ends it.
              onClick={(e) => { if (e.detail === 0) { if (wanted.current) stopListening(); else void startListening(); } }}
              aria-label={micLabel}
              aria-pressed={listening}
              title={micLabel}
              className={`relative flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${listening ? 'bg-ink-danger text-background' : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/10'}`}
            >
              {listening && (
                // Grows with the voice, so it is plain that it is hearing.
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-ink-danger/50 transition-transform duration-75" style={{ transform: `scale(${1 + level * 0.35})` }} />
              )}
              {listening ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}
            </button>
          )}
          <label className="sr-only" htmlFor="assistant-ask">Ask the assistant</label>
          <input
            id="assistant-ask"
            ref={inputRef}
            value={listening ? '' : text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={busy || listening}
            autoComplete="off"
            placeholder={listening ? (working > 0 ? 'Doing that… keep going, I am listening' : 'Listening… say each thing, then tap ■ when you are done') : busy || working > 0 ? 'Working on it…' : canHear && !recordingVisit ? (onVisit ? 'Tell me what to do: “order a CBC”, “BP 130 by 80”' : 'Ask, or tap the mic and say it') : 'Ask for anything'}
            className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <button type="submit" disabled={busy || listening || (!text.trim() && !waiting)} aria-label={!text.trim() && waiting ? 'Confirm' : 'Ask'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30">
            <CornerDownLeft size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
