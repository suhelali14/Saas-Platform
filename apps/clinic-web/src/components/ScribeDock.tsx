import { useLocation, useNavigate } from 'react-router-dom';
import { Square, NotebookPen } from 'lucide-react';
import { clock, useScribe } from '../contexts/ScribeContext';
import { Button } from './Button';

/**
 * The consultation being listened to, shown wherever the doctor has gone.
 *
 * While a visit is being listened to, the doctor is free to open the
 * patient's history, an old report, anything -- and this row follows
 * them, the way a call in progress follows you out of the phone app. It
 * says who is being listened to, for how long and what is being written,
 * and it is one tap back to the note.
 *
 * It is a row of the assistant's bar (components/AssistantBar.tsx), and
 * is not shown on the visit's own page, where the full note is already
 * on screen and a second copy of it would only be in the way.
 */
export function ScribeStatusRow() {
  const s = useScribe();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (s.phase === 'idle' || !s.appointmentId) return null;
  const home = `/appointments/${s.appointmentId}/encounter`;
  if (pathname === home) return null;

  const stopAndOpen = async () => {
    navigate(home);
    await s.finish();
  };

  return (
    <div role="status" aria-label="The assistant is listening to a visit" className="flex items-center gap-3 border-b border-border/15 px-4 py-2.5">
      {s.phase === 'listening' && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink-danger animate-pulse" aria-hidden="true" />}
      <button type="button" onClick={() => navigate(home)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14px] font-semibold">
          {s.phase === 'listening' && <>Listening · {clock(s.elapsed)} · {s.patientName}</>}
          {s.phase === 'finishing' && <>Reading it through · {s.patientName}</>}
          {s.phase === 'review' && <>Note ready to check · {s.patientName}</>}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {s.phase === 'listening' ? `${s.doing} · speech heard ${clock(s.sentSeconds)}` : s.phase === 'review' ? 'Nothing is saved until you confirm it.' : 'One moment.'}
        </span>
      </button>
      {s.phase === 'listening' ? (
        <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={stopAndOpen}>Stop</Button>
      ) : (
        <Button variant="secondary" size="sm" icon={<NotebookPen size={13} />} onClick={() => navigate(home)}>Open</Button>
      )}
    </div>
  );
}
