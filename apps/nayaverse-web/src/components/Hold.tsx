/**
 * The switch for a piece of the board that moves on its own: pause while it
 * runs, play while it is held, and run-again once it has finished its pass.
 *
 * A small square switch screwed to the board, quieter than the lit plate --
 * it is a control on the equipment, not an action the page wants taken.
 *
 * Rendered from the first paint and only hidden until it can do something,
 * so the row it sits in never changes width when the page comes alive.
 * `visibility` rather than `display`: it keeps its space and leaves the
 * focus order while it is inert.
 */
export type HoldState = 'running' | 'held' | 'done';

export function Hold({
  state,
  live,
  onClick,
  pause,
  play,
  again,
}: {
  state: HoldState;
  live: boolean;
  onClick: () => void;
  pause: string;
  play: string;
  again: string;
}) {
  const label = state === 'running' ? pause : state === 'held' ? play : again;
  return (
    <button
      type="button"
      className="hold"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={live ? undefined : { visibility: 'hidden' }}
    >
      <svg
        viewBox="0 0 12 12"
        width="12"
        height="12"
        aria-hidden="true"
        fill={state === 'done' ? 'none' : 'currentColor'}
        stroke={state === 'done' ? 'currentColor' : 'none'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {state === 'running' && <path d="M3 2.4h2.1v7.2H3zM6.9 2.4H9v7.2H6.9z" />}
        {state === 'held' && <path d="M3.5 2.2v7.6L9.6 6z" />}
        {state === 'done' && (
          <>
            <path d="M9.6 6.4A3.6 3.6 0 1 1 8.5 3.4" />
            <path d="M8.9 1.4v2.3H6.6" />
          </>
        )}
      </svg>
    </button>
  );
}
