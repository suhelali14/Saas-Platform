import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mic, CornerDownLeft, X, Check } from 'lucide-react';
import { apiFetch, apiUpload, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { useScribe } from '../contexts/ScribeContext';
import { ScribeStatusRow } from './ScribeDock';
import { Button } from './Button';

/**
 * The assistant, on every screen.
 *
 * One line at the bottom of the portal. Somebody types what they want, or
 * holds the microphone and says it -- "show her last prescription", "who
 * is next", "open billing", "add her husband Rajesh to the family" -- and
 * the app does it. They do not need to know where anything is.
 *
 * ── What it does with a request ──────────────────────────────────────
 *
 * Sends the words to the clinic's own API, which works out which of the
 * app's actions was meant (by rule when it can, by a language model when
 * it must) and runs it with the asker's own permissions. See
 * apps/clinic-api/src/lib/assistant/registry.ts.
 *
 *   a lookup   comes back as a short answer, each line a link into the app
 *   a screen   is opened
 *   a change   comes back as a card saying exactly what will be done, and
 *              is made only when Confirm is pressed
 *
 * ── Why the microphone is held, not left on ──────────────────────────
 *
 * An assistant that listens all day for its name sends audio to a speech
 * service all day, and a clinic would pay for hours of silence and
 * waiting-room chatter. Held, it hears one request and costs a few
 * seconds.
 */

interface Line { label?: string; text: string; to?: string; tone?: 'danger' | 'warning' | 'muted' }
type Reply =
  | { kind: 'answer'; title: string; lines: Line[]; to?: string; toLabel?: string }
  | { kind: 'go'; to: string; say: string }
  | { kind: 'confirm'; action: string; params: Record<string, unknown>; title: string; lines: Line[]; patientId: string | null; appointmentId: string | null; seal: string }
  | { kind: 'done'; say: string; to?: string }
  | { kind: 'sorry'; say: string };

interface Asked { reply: Reply; heard?: string; by?: 'rule' | 'model' | 'none'; request?: string }

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
const ANYWHERE = ['Who is next', 'What needs attention', 'Follow-ups due', "Today's collection"];

/** A request is one sentence. Past this the microphone lets go by itself. */
const MAX_HOLD_MS = 20_000;

export function AssistantBar() {
  const { hasModule } = useClinicAuth();
  const scribe = useScribe();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [text, setText] = useState('');
  const [asked, setAsked] = useState<Asked | null>(null);
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [canHear, setCanHear] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);
  // The recorder's callback outlives the render it was made in.
  const askedRef = useRef<Asked | null>(null);
  askedRef.current = asked;
  /** The button is down. The microphone takes a moment to open, and by
   *  then the button may already be up again. */
  const wantHold = useRef(false);

  // A card says "do this for the patient on screen". Once another screen
  // is open that is no longer who is on screen, so the card goes: it is
  // never left showing over a different patient with a Confirm on it.
  // (The server would refuse it anyway; see lib/assistant/seal.ts.)
  useEffect(() => {
    setAsked((current) => (current?.reply.kind === 'confirm' ? null : current));
  }, [pathname]);

  // Leaving the portal, or the bar being taken down, lets go of the
  // microphone whatever state it was in.
  useEffect(() => () => {
    wantHold.current = false;
    cancelled.current = true;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
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
      if (e.key === 'Escape' && asked) setAsked(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, asked]);

  if (!enabled) return null;

  const show = (result: Asked) => {
    setAsked(result);
    if (result.reply.kind === 'go') navigate(result.reply.to);
  };

  const fail = (e: unknown) => setAsked({ reply: { kind: 'sorry', say: e instanceof ApiError ? e.message : 'The assistant could not be reached. Try again in a moment.' } });

  const ask = async (words: string) => {
    const request = words.trim();
    if (!request || busy) return;
    setBusy(true);
    try {
      const result = await apiFetch<Asked>('/assistant/ask', { method: 'POST', data: { text: request, ...onScreen(pathname), pending: pendingFrom(asked) } });
      show({ ...result, request });
      setText('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (reply: Extract<Reply, { kind: 'confirm' }>) => {
    setBusy(true);
    try {
      // The patient and visit the card was drawn up for, with its seal --
      // not whoever is on screen at the moment of the tap.
      const result = await apiFetch<Asked>('/assistant/run', {
        method: 'POST',
        data: { action: reply.action, params: reply.params, patientId: reply.patientId, appointmentId: reply.appointmentId, seal: reply.seal },
      });
      setAsked(result);
      // What is on screen may have just changed underneath it.
      window.dispatchEvent(new CustomEvent('assistant:changed'));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // ── Hold to talk ─────────────────────────────────────────────────────
  const startHolding = async () => {
    if (holding || busy || wantHold.current) return;
    wantHold.current = true;
    cancelled.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      // Let go while the microphone was still opening -- a quick tap, or
      // a finger lifted to answer the browser's permission prompt. With
      // nobody holding, recording now would run on, unheld, to the limit.
      if (!wantHold.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      const parts: Blob[] = [];
      const startedAt = Date.now();
      rec.ondataavailable = (e) => { if (e.data.size > 0) parts.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        wantHold.current = false;
        setHolding(false);
        // A tap, not a hold: nothing was said.
        if (cancelled.current || Date.now() - startedAt < 500 || parts.length === 0) return;
        const blob = new Blob(parts, { type: rec.mimeType });
        const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        setBusy(true);
        try {
          const context = onScreen(window.location.pathname);
          const fields: Record<string, string> = {};
          if (context.patientId) fields.patientId = context.patientId;
          if (context.appointmentId) fields.appointmentId = context.appointmentId;
          const pending = pendingFrom(askedRef.current);
          if (pending) { fields.pendingRequest = pending.request; fields.pendingQuestion = pending.question; }
          const result = await apiUpload<Asked>('/assistant/voice', new File([blob], `ask-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' }), fields);
          show({ ...result, request: result.heard });
        } catch (e) {
          fail(e);
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      recorder.current = rec;
      setHolding(true);
      holdTimer.current = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, MAX_HOLD_MS);
    } catch {
      wantHold.current = false;
      setAsked({ reply: { kind: 'sorry', say: 'This browser was not allowed to use the microphone. Allow it in the address bar, or type what you need.' } });
    }
  };

  const stopHolding = (cancel = false) => {
    wantHold.current = false;
    cancelled.current = cancel;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  };

  // A consultation is using the microphone to write a note. A request
  // spoken now would be written into that note as something the doctor
  // said to the patient, so while it listens, requests are typed.
  const recordingVisit = scribe.phase === 'listening';
  const reply = asked?.reply;
  const tone = (line: Line) => (line.tone === 'danger' ? 'text-ink-danger font-semibold' : line.tone === 'warning' ? 'text-ink-warning' : line.tone === 'muted' ? 'text-muted-foreground' : '');

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl md:left-[calc(15rem+0.75rem)] print:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* ── What it answered ─────────────────────────────────────────── */}
      {reply && reply.kind !== 'go' && (
        <div className="mb-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-border/20 bg-background p-4 shadow-overlay" role="status" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {asked?.heard && <p className="mb-1 text-[12px] text-muted-foreground">You said: “{asked.heard}”</p>}
              {(reply.kind === 'answer' || reply.kind === 'confirm') && <h3 className="text-[15px] font-semibold">{reply.title}</h3>}
              {(reply.kind === 'sorry' || reply.kind === 'done') && <p className="text-[14px]">{reply.say}</p>}
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
              <span className="text-[12px] text-muted-foreground">Nothing has been changed yet.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Things to ask, while the line is empty and in use ────────── */}
      {focused && !text && !reply && !busy && !holding && (
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
          onSubmit={(e) => { e.preventDefault(); void ask(text); }}
          className="flex items-center gap-2 px-2 py-2"
        >
          {canHear && (
            <button
              type="button"
              disabled={recordingVisit || busy}
              onPointerDown={(e) => { e.preventDefault(); void startHolding(); }}
              onPointerUp={() => stopHolding()}
              onPointerLeave={() => holding && stopHolding()}
              onPointerCancel={() => stopHolding(true)}
              onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void startHolding(); } }}
              onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stopHolding(); }}
              // Focus moved away with the key still down: there will be
              // no key-up here to end it.
              onBlur={() => { if (wantHold.current) stopHolding(); }}
              aria-label={recordingVisit ? 'The microphone is writing a visit note. Type your request.' : 'Hold to talk to the assistant'}
              title={recordingVisit ? 'The microphone is writing a visit note. Type your request.' : 'Hold and speak, then let go'}
              className={`flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${holding ? 'bg-ink-danger text-background' : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/10'}`}
            >
              <Mic size={18} />
            </button>
          )}
          <label className="sr-only" htmlFor="assistant-ask">Ask the assistant</label>
          <input
            id="assistant-ask"
            ref={inputRef}
            value={holding ? '' : text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={busy || holding}
            autoComplete="off"
            placeholder={holding ? 'Listening… let go when done' : busy ? 'Working on it…' : canHear && !recordingVisit ? 'Ask, or hold the mic and say it' : 'Ask for anything'}
            className="h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <button type="submit" disabled={busy || holding || !text.trim()} aria-label="Ask" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30">
            <CornerDownLeft size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
