/**
 * A working day, one chart per trade -- and the one authored moment on the site.
 *
 * Five tabs over one chart component, because that is the argument: a salon's
 * chairs, a gym's memberships and a clinic's queue are the same records with
 * different words on them. Building five bespoke mock-ups would have made the
 * opposite case.
 *
 * Only the clinic tab moves. An emergency walks in while you are reading and
 * the chart re-ranks: ahead of everyone waiting, behind the person already
 * being seen. The other four are designs for rows still being built, and they
 * say so in a line nobody can miss -- a design that animates is pretending to
 * be a product.
 */
import { useEffect, useRef, useState } from 'react';
import { useContent } from '@/content/use-content';
import {
  chartDefs,
  clinicArrival,
  TIER,
  type ChartRowDef,
  type Readiness,
  type Tone,
} from '@/content/structure';
import { Band, BandItem, Caret, Heading, Panel, Stamp, cx } from '@/components/primitives';

const TONE_CELL: Record<Tone, string> = {
  serving: 'cell-serving',
  next: 'cell-next',
  waiting: 'cell-waiting',
  done: 'cell-done',
};

const STATUS_CELL: Record<Readiness, string> = {
  LIVE: 'cell-serving',
  BUILDING: 'cell-waiting',
  WAITLIST: 'cell-done',
};

const HIDE: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

type Seated = ChartRowDef & { arrival: number };

/* Someone already being seen stays put and finished rows stay above as the
   morning's history; everyone else is ordered by priority tier, then by who
   got here first. The tier is read off markKey, never off the visible label,
   so a translation can never change the order rows come out in. */
const tierOf = (r: ChartRowDef) => (r.markKey ? (TIER[r.markKey] ?? 3) : 3);
const rank = (r: Seated) => (r.tone === 'done' ? -2 : r.tone === 'serving' ? -1 : tierOf(r));
const sortQueue = (rows: Seated[]) =>
  [...rows].sort((a, b) => rank(a) - rank(b) || a.arrival - b.arrival);
const seat = (rows: ChartRowDef[]): Seated[] => rows.map((r, i) => ({ ...r, arrival: i }));

export function DayCharts() {
  const { charts, chartSection, readiness } = useContent();
  const [active, setActive] = useState(0);
  const [extra, setExtra] = useState<Seated[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [clock, setClock] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const def = chartDefs[active]!;
  const words = charts[def.key as keyof typeof charts] as (typeof charts)['clinic'];
  const isLive = def.status === 'LIVE';
  const admitted = extra !== null;

  const rows: Seated[] = isLive && extra ? extra : seat(def.rows);

  /* The live element: a clock that is really running, so the chart is current
     rather than printed once. Started after mount -- a time baked in at build
     would be wrong by the time anybody read it. */
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const admit = () => {
    const base = seat(chartDefs[0]!.rows).map((r) =>
      // Whoever was next is now behind the emergency.
      r.tone === 'next' ? { ...r, tone: 'waiting' as Tone } : r,
    );
    base.push({ ...clinicArrival, arrival: base.length });
    setExtra(sortQueue(base));
  };

  const reset = () => {
    setExtra(null);
    setOpen(null);
  };

  /* Fires once, when the chart is actually on screen. Admitting the patient
     while the panel is three screens away spends the moment on nobody. */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || admitted || !isLive) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.disconnect();
          timer = window.setTimeout(admit, 2400);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admitted, isLive]);

  const pick = (i: number) => {
    setActive(i);
    setOpen(null);
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const last = chartDefs.length - 1;
    const to =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to);
    tabRefs.current[to]?.focus();
  };

  const rowWords = (id: string) =>
    (words.rows as Record<string, (typeof words.rows)['04']>)[id];

  return (
    <section id="queue" className="frame void" ref={sectionRef}>
      <Panel>
        <Band>
          <BandItem>{words.bandTitle}</BandItem>
          <BandItem>
            <span data-figures>{rows.length}</span> {words.unit}
          </BandItem>
          <BandItem grow>
            <span className="text-[var(--ink-faint)]">{chartSection.clock}</span>{' '}
            <time data-figures>{clock ?? '--:--:--'}</time>
          </BandItem>
          <BandItem>
            <Stamp>{chartSection.bandTitle}</Stamp>
          </BandItem>
        </Band>

        <div className="px-4 pb-5 pt-7 sm:px-7">
          <Heading>{chartSection.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{chartSection.lede}</p>
        </div>

        {/* The trades. Horizontally scrollable on a phone rather than wrapped
            into three ragged lines. */}
        <div
          role="tablist"
          aria-label={chartSection.heading}
          className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-5 sm:px-7"
        >
          {chartDefs.map((g, i) => {
            const on = i === active;
            const tab = (charts[g.key as keyof typeof charts] as (typeof charts)['clinic']).tab;
            return (
              <button
                key={g.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`tab-${g.key}`}
                aria-selected={on}
                aria-controls={`panel-${g.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cx(
                  'flex shrink-0 items-center gap-2 border px-3 py-2 transition-colors',
                  on
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--chart)]'
                    : 'border-[color-mix(in_srgb,var(--rule)_34%,transparent)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]',
                )}
                style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
              >
                <span className="t-board text-[1.0625rem] leading-none">{tab}</span>
                <span
                  className={cx(
                    'cell !border-current !px-1.5 !py-0 !text-[0.5625rem]',
                    on
                      ? cx('!bg-transparent', g.status === 'LIVE' ? '!text-[var(--lamp)]' : '!text-[var(--chart-band)]')
                      : STATUS_CELL[g.status],
                  )}
                >
                  {readiness[g.status]}
                </span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${def.key}`} aria-labelledby={`tab-${def.key}`}>
          <div className="px-4 pb-4 sm:px-7">
            <h3 className="t-board text-[1.45rem] leading-none text-[var(--ink)]">{words.heading}</h3>
            <p className="t-prose mt-3 text-[0.9375rem] text-[var(--ink-soft)]">{words.lede}</p>

            {/* The line that keeps this section honest. */}
            <p
              className={cx(
                'notice t-prose mt-4 px-3.5 py-2.5 text-[0.9375rem]',
                isLive ? 'notice-live' : 'notice-building',
              )}
            >
              <strong className="font-semibold">
                {isLive ? chartSection.live : chartSection.notBuilt}{' '}
              </strong>
              {isLive ? chartSection.liveNotice : chartSection.buildingNotice}
            </p>

            <p className="mt-4 text-sm text-[var(--ink-faint)]">{chartSection.hint}</p>
          </div>
        <div className="w-full overflow-x-auto">

            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{words.heading}</caption>
              <thead>
                <tr className="t-label rule-head text-[var(--ink-soft)]">
                  {def.columns.map((c, i) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cx(
                        'py-2 pr-3 font-semibold',
                        i === 0 && 'pl-4 sm:pl-7',
                        c.right && 'text-right',
                        c.hide && HIDE[c.hide],
                      )}
                    >
                      {charts.columnLabels[c.key as keyof typeof charts.columnLabels]}
                    </th>
                  ))}
                  <th scope="col" className="py-2 pr-4 text-right font-semibold sm:pr-7">
                    {chartSection.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const w = rowWords(row.id);
                  if (!w) return null;
                  const isOpen = open === row.id;
                  const isNew = admitted && row.id === clinicArrival.id;
                  const detailId = `${def.key}-${row.id}`;
                  const hasDetail = w.detail.length > 0;
                  return [
                    <tr
                      key={row.id}
                      className={cx(
                        'rule-row align-middle transition-colors',
                        hasDetail && 'cursor-pointer',
                        isNew && 'row-arrived',
                        isOpen
                          ? 'bg-[color-mix(in_srgb,var(--stamp)_7%,transparent)]'
                          : hasDetail && 'hover:bg-[color-mix(in_srgb,var(--rule)_7%,transparent)]',
                      )}
                      style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                      onClick={() => hasDetail && setOpen(isOpen ? null : row.id)}
                    >
                      {def.columns.map((c, i) => {
                        const value =
                          c.key === 'mark'
                            ? w.mark
                            : (row.cells[c.key] ?? (w as unknown as Record<string, string>)[c.key] ?? '');
                        return (
                          <td
                            key={c.key}
                            className={cx(
                              't-row py-2.5 pr-3',
                              i === 0 && 'pl-4 sm:pl-7',
                              c.right && 'text-right',
                              c.hide && HIDE[c.hide],
                              row.tone === 'done' ? 'text-[var(--ink-faint)]' : 'text-[var(--ink-soft)]',
                            )}
                          >
                            {c.key === 'mark' ? (
                              // Only the exception is marked; the norm carries none.
                              w.mark && (
                                <span className={cx('quota', row.urgent && 'quota-urgent')}>{w.mark}</span>
                              )
                            ) : i === 0 ? (
                              <span className="flex items-center gap-2">
                                {row.tone === 'serving' && <span className="lamp" aria-hidden="true" />}
                                <span data-figures>{value}</span>
                              </span>
                            ) : i === 1 && hasDetail ? (
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={detailId}
                                className="flex items-center gap-1.5 text-left"
                              >
                                <Caret open={isOpen} className="text-[var(--ink-faint)]" />
                                <span data-figures>{value}</span>
                              </button>
                            ) : (
                              <>
                                <span data-figures={c.right ? '' : undefined}>{value}</span>
                                {/* The marker's own column is dropped on a phone,
                                    so it rides here instead. Without it, the row
                                    that jumped the queue gives no reason why. */}
                                {c.primary && w.mark && (
                                  <span className="mt-1 block md:hidden">
                                    <span className={cx('quota', row.urgent && 'quota-urgent')}>
                                      {w.mark}
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 pr-4 text-right sm:pr-7">
                        <span className={cx('cell', TONE_CELL[row.tone], isNew && 'cell-flip')}>
                          {w.status}
                        </span>
                      </td>
                    </tr>,

                    isOpen && hasDetail && (
                      <tr key={`${row.id}-d`} id={detailId} className="rule-row">
                        <td />
                        <td colSpan={def.columns.length} className="pb-6 pr-4 pt-1 sm:pr-7">
                          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
                            {w.detail.map((f) => (
                              <div key={f.label} className="contents">
                                <dt className="t-label pt-1 text-[var(--ink-faint)]">{f.label}</dt>
                                <dd className="text-[0.9375rem] text-[var(--ink)]">{f.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
        </div>

          <div className="rule-total flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-7">
            <p className="t-prose text-sm text-[var(--ink-soft)]">{words.note}</p>
            {isLive &&
              (admitted ? (
                <button
                  type="button"
                  onClick={reset}
                  className="t-label shrink-0 border border-[color-mix(in_srgb,var(--rule)_40%,transparent)] px-3 py-2 text-[var(--ink-soft)] transition-colors hover:border-[var(--ink-soft)] hover:text-[var(--ink)]"
                  style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                >
                  {chartSection.again}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={admit}
                  className="t-label shrink-0 border border-[color-mix(in_srgb,var(--priority)_55%,transparent)] px-3 py-2 text-[var(--priority)] transition-colors hover:bg-[color-mix(in_srgb,var(--priority)_9%,transparent)]"
                  style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                >
                  {chartSection.walkIn}
                </button>
              ))}
          </div>
        </div>
      </Panel>

      {/* The chart changes under a reader who may not be looking at it. */}
      <p aria-live="polite" className="sr-only">
        {admitted && isLive ? chartSection.announce : ''}
      </p>
    </section>
  );
}
