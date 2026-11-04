/**
 * The departure line on the destination board.
 *
 * One row of split-flap units, which makes one pass through a few rows of
 * the service chart when it comes into view and then rests on the clinic:
 * its number, the business, and the status that row really has. Clinic
 * reads Live; the others read Building or Waitlist, because that is what
 * they are.
 *
 * The business and its status turn together, as one row. They must never be
 * caught mid-change showing one trade beside another's status -- for a
 * moment, a Building trade beside "Live" is exactly the claim this site's
 * build refuses to ship. So the name drum holds only the rows the board
 * stops at, each change is one card, and the status turns in the same beat.
 * The digits are free to ripple; a number makes no claim.
 *
 * It repeats rows the chart below already lists, so the whole line is
 * hidden from assistive technology. The switch beside it is not.
 */
import { useEffect, useMemo, useState } from 'react';
import { useContent } from '@/content/use-content';
import { serviceRows, type Readiness } from '@/content/structure';
import { FlapWheel } from '@/components/Flap';
import { Hold } from '@/components/Hold';
import { useLoop } from '@/components/useLoop';

/** Rows the board stops at, chosen to show the spread of the chart. */
const STOPS = ['01', '04', '10', '13', '15', '16', '22'];
const ROWS = STOPS.map((code) => serviceRows.find((r) => r.code === code)!);
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const WHEEL: Readiness[] = ['LIVE', 'BUILDING', 'WAITLIST'];
const TONES = ['var(--lamp)', 'var(--board-ink)', 'var(--board-ink-soft)'];
/** Long enough to read a row before it turns. */
const DWELL = 4200;
/** The name and status turn in the same beat. */
const ROW_DELAY = 150;
const ROW_STEP = 170;

export function Departures() {
  const { services, readiness, motionControls } = useContent();
  const loop = useLoop<HTMLDivElement>(0.6, { holdWhileRead: true });
  const [n, setN] = useState(0);
  const [turns, setTurns] = useState(0);
  // One pass: every stop once, back to the clinic, and rest there.
  const done = turns >= STOPS.length;

  useEffect(() => {
    if (!loop.running || done) return;
    const t = window.setInterval(() => {
      setN((k) => (k + 1) % STOPS.length);
      setTurns((k) => k + 1);
    }, DWELL);
    return () => window.clearInterval(t);
  }, [loop.running, done]);

  const names = useMemo(
    () => ROWS.map((r) => services[r.code as keyof typeof services].name),
    [services],
  );
  const statuses = useMemo(() => WHEEL.map((s) => readiness[s]), [readiness]);
  const code = STOPS[n];

  const onHold = () => {
    if (!done) return loop.toggle();
    setTurns(0);
    if (loop.held) loop.toggle();
  };

  return (
    <div ref={loop.ref} className="departures">
      <span className="dep-code" aria-hidden="true">
        <FlapWheel items={DIGITS} index={Number(code[0])} step={84} uniform />
        <FlapWheel items={DIGITS} index={Number(code[1])} step={84} delay={70} uniform />
      </span>
      <span className="dep-name" aria-hidden="true">
        <FlapWheel items={names} index={n} step={ROW_STEP} delay={ROW_DELAY} fill />
      </span>
      <span className="dep-status" aria-hidden="true">
        <FlapWheel
          items={statuses}
          tones={TONES}
          index={WHEEL.indexOf(ROWS[n].status)}
          step={ROW_STEP}
          delay={ROW_DELAY}
        />
      </span>
      <span className="dep-hold">
        <Hold
          state={done ? 'done' : loop.held ? 'held' : 'running'}
          live={loop.live}
          onClick={onHold}
          pause={motionControls.pauseBoard}
          play={motionControls.playBoard}
          again={motionControls.againBoard}
        />
      </span>
    </div>
  );
}
