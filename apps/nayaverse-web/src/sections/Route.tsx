/**
 * The route: one sale, followed round the system.
 *
 * The hero's route strip, built, in the same order. A cream chart lists the
 * six desks; beside it, through a window in the panel, a model yard: six
 * sheds on a loop of track, a stack of chart sheets in the middle, and a
 * trolley carrying the sale's slip from desk to desk. As it pulls in, that
 * desk's line rules itself in to the stack and a sheet lands on it: every
 * desk writes to the same record, which is the product's whole argument in
 * one picture. The trolley makes one circuit when the section comes into
 * view and stops; the switch runs it again.
 *
 * Built from CSS 3D transforms rather than WebGL: real perspective on the
 * GPU, a few kilobytes, and it runs on the phone this site is mostly read
 * on. The listing carries every word, so the model is an illustration of
 * the chart and never the only place a fact lives.
 */
import { useState, type CSSProperties } from 'react';
import { useContent } from '@/content/use-content';
import { Band, BandItem, Heading, Panel } from '@/components/primitives';
import { Hold } from '@/components/Hold';
import { useLoop } from '@/components/useLoop';
import { CYCLE, PLANE, SLOT, record, stations, trackPath } from '@/components/yard';
// The trolley's run, generated from the same geometry by vite.config.ts.
import 'virtual:yard-lamp.css';

const RAIL = trackPath(0);
const RAIL_IN = trackPath(0.32);
const RAIL_OUT = trackPath(-0.32);

const num = (i: number) => String(i + 1).padStart(2, '0');
const at = (i: number): CSSProperties => ({ animationDelay: `${i * SLOT}s` });

export function Route() {
  const { hero, routePanel, motionControls } = useContent();
  const loop = useLoop<HTMLDivElement>(0.25);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);

  const onHold = () => {
    if (!done) return loop.toggle();
    setDone(false);
    setRound((r) => r + 1);
    if (loop.held) loop.toggle();
  };

  const timing = {
    '--yard-cycle': `${CYCLE}s`,
    '--yard-slot': `${SLOT}s`,
  } as CSSProperties;

  return (
    <section id="system" className="frame void">
      <Panel>
        <Band>
          <BandItem>{routePanel.bandTitle}</BandItem>
          <BandItem grow>{routePanel.bandDetail}</BandItem>
        </Band>

        <div className="px-4 pt-7 sm:px-7">
          <Heading>{routePanel.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{routePanel.lede}</p>
        </div>

        <div
          ref={loop.ref}
          className="yard grid gap-x-9 gap-y-7 px-4 pb-6 pt-7 sm:px-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]"
          // Left running once done, so the last desk's light finishes fading
          // and the picture rests with every line ruled and nothing lit.
          data-run={loop.running ? '' : undefined}
          data-done={done ? '' : undefined}
          style={timing}
        >
          {/* A window in the chart, onto the model. Decorative: the
              listing beside it says everything. */}
          <div className="yard-inset">
            <div key={round} className="yard-stage" aria-hidden="true">
              <div
                className="yard-plane"
                style={{ width: `${PLANE.w}em`, height: `${PLANE.h}em` }}
              >
                <svg
                  className="yard-floor"
                  viewBox={`0 0 ${PLANE.w} ${PLANE.h}`}
                  width="100%"
                  height="100%"
                >
                  {/* Each desk's line to the record: pencilled at rest,
                      ruled in when the trolley reaches it. */}
                  {stations.map((s, i) => (
                    <g key={i}>
                      <line x1={s.x} y1={s.y} x2={record.x} y2={record.y} className="yard-rule" />
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={record.x}
                        y2={record.y}
                        pathLength={1}
                        className="yard-rule-in ya"
                        style={at(i)}
                      />
                    </g>
                  ))}
                  <path d={RAIL} className="yard-sleepers" />
                  <path d={RAIL_IN} className="yard-rail" />
                  <path d={RAIL_OUT} className="yard-rail" />
                  {stations.map((s, i) => (
                    <circle key={i} cx={s.stop.x} cy={s.stop.y} r={0.42} className="yard-stop" />
                  ))}
                </svg>

                {/* The record: chart sheets, stacked and ruled. */}
                <div
                  className="yard-box yard-record"
                  style={box(record.x, record.y, record.w, record.d, record.h)}
                >
                  <span className="yard-face yard-top">
                    <span className="yard-record-label">{routePanel.record}</span>
                  </span>
                  <span className="yard-face yard-front" />
                  <span className="yard-face yard-left" />
                  {/* A sheet, written at each desk, landing on the stack. */}
                  <span className="yard-sheet ya" />
                </div>

                {stations.map((s, i) => (
                  <div
                    key={i}
                    className="yard-box yard-shed"
                    style={box(s.x, s.y, s.w, s.d, s.h)}
                  >
                    <span className="yard-face yard-top">
                      <span className="yard-num" data-figures>
                        {num(i)}
                      </span>
                      <span className="yard-name">{hero.route[i]}</span>
                      <span className="yard-fitting">
                        <span className="yard-fitting-lit ya" style={at(i)} />
                      </span>
                    </span>
                    <span className="yard-face yard-front">
                      <span className="yard-edge-lit ya" style={at(i)} />
                    </span>
                    <span className="yard-face yard-left" />
                  </div>
                ))}

                {/* The trolley, carrying the sale's slip. */}
                <div
                  className="yard-trolley-run ya"
                  onAnimationEnd={(e) => {
                    if (e.animationName === 'yard-lamp') setDone(true);
                  }}
                >
                  <div className="yard-box yard-trolley" style={box(0, 0, 1.9, 1.9, 0.95)}>
                    <span className="yard-face yard-top" />
                    <span className="yard-face yard-front">
                      <span className="yard-trolley-lamp" />
                    </span>
                    <span className="yard-face yard-left" />
                  </div>
                </div>
              </div>
            </div>

            <div className="yard-hold">
              <Hold
                state={done ? 'done' : loop.held ? 'held' : 'running'}
                live={loop.live}
                onClick={onHold}
                pause={motionControls.pauseRoute}
                play={motionControls.playRoute}
                again={motionControls.againRoute}
              />
            </div>
          </div>

          {/* The chart: every desk, in order; the row being served is lit. */}
          <ol key={round} className="yard-list self-center">
            {hero.route.map((stop, i) => (
              <li key={stop} className="yard-item">
                <span className="yard-item-tint ya" style={at(i)} />
                <span className="t-label yard-item-num" data-figures>
                  {num(i)}
                </span>
                <div className="relative min-w-0">
                  <div className="t-board yard-item-name">{stop}</div>
                  <p className="mt-1 text-sm leading-snug text-[var(--ink-soft)]">
                    {routePanel.stops[i]}
                  </p>
                </div>
                <span className="yard-item-lamp ya" style={at(i)} />
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 pb-6 sm:px-7">
          <p className="max-w-[68ch] text-sm text-[var(--ink-soft)]">{routePanel.note}</p>
        </div>
      </Panel>
    </section>
  );
}

/** Footprint centred on (x, y), with its height as a variable for the faces. */
function box(x: number, y: number, w: number, d: number, h: number): CSSProperties {
  return {
    left: `${x - w / 2}em`,
    top: `${y - d / 2}em`,
    width: `${w}em`,
    height: `${d}em`,
    '--h': `${h}em`,
  } as CSSProperties;
}
