import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx } from '@/components/primitives';

/**
 * One wheel of a split-flap board.
 *
 * A real flap unit is a drum of printed cards: to get from one card to
 * another it turns over every card in between, in order, and each turn is
 * the top half falling forward over a hinge to become the bottom half. That
 * is what this draws -- in perspective, so the falling card actually comes
 * towards the reader -- and it is why a change "cascades": a wheel with far
 * to go keeps turning after its neighbours have stopped.
 *
 * Digits are one wheel per character. Names and statuses are one wheel per
 * field, the way destination blinds are printed whole -- which is also the
 * only honest way to flip Devanagari, where a conjunct cut into character
 * cells would no longer be a word.
 *
 * The prerendered HTML is the settled card, printed twice in two clipped
 * halves. No animation exists until the index changes, which only happens
 * after hydration.
 */
export function FlapWheel({
  items,
  index,
  step = 140,
  delay = 0,
  tones,
  fill = false,
  uniform = false,
  className,
}: {
  items: readonly string[];
  index: number;
  /** Milliseconds per card turned. */
  step?: number;
  /** Milliseconds before this wheel starts, for the left-to-right ripple. */
  delay?: number;
  /** A colour per card, so a status reads in its own ink while it turns. */
  tones?: readonly string[];
  /** Take the width of the column rather than of the widest card. For a
   *  long drum (every business on the chart) whose widest card would not
   *  fit a phone. */
  fill?: boolean;
  /** Every card is the same width (tabular digits), so one card sizes the
   *  unit and the other nine need not be in the page. */
  uniform?: boolean;
  className?: string;
}) {
  const [turn, setTurn] = useState<{ from: number; to: number; n: number } | null>(null);
  const shown = useRef(index);
  const count = useRef(0);

  useEffect(() => {
    if (index === shown.current) return;
    let timer = window.setTimeout(function advance() {
      const from = shown.current;
      if (from === index) {
        setTurn(null);
        return;
      }
      const to = (from + 1) % items.length;
      shown.current = to;
      count.current += 1;
      setTurn({ from, to, n: count.current });
      timer = window.setTimeout(advance, step);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [index, items.length, step, delay]);

  const now = turn ? turn.to : shown.current;
  const tone = (i: number) => (tones ? { color: tones[i] } : undefined);

  return (
    <span
      className={cx('flap', fill && 'flap-fill', className)}
      style={{ '--flap-half': `${Math.round(step / 2)}ms` } as CSSProperties}
    >
      {/* In flow and invisible: every card stacked in one cell, so the unit
          is as wide as its widest card and the row never changes width
          whichever card is showing. */}
      <span className="flap-sizer">
        {fill || uniform ? (
          <span>{items[now]}</span>
        ) : (
          items.map((item, i) => <span key={i}>{item}</span>)
        )}
      </span>

      <span className="flap-half flap-top" style={tone(now)}>
        <span className="flap-face">{items[now]}</span>
      </span>
      <span className="flap-half flap-bottom" style={tone(turn ? turn.from : now)}>
        <span className="flap-face">{items[turn ? turn.from : now]}</span>
      </span>

      {turn && (
        <>
          <span key={`f${turn.n}`} className="flap-half flap-top flap-fall" style={tone(turn.from)}>
            <span className="flap-face">{items[turn.from]}</span>
          </span>
          <span key={`l${turn.n}`} className="flap-half flap-bottom flap-land" style={tone(turn.to)}>
            <span className="flap-face">{items[turn.to]}</span>
          </span>
        </>
      )}
    </span>
  );
}
