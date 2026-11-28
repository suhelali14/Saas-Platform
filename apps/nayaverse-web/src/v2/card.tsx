/**
 * Two sections the site gained on 28 November 2026:
 *
 *   - QrCard: Growth's two QR cards as one PVC card in three.js (card3d.ts),
 *     the counter face (reviews on Google) and the table face (menu and
 *     order), both with real codes that open the Growth page. Before the 3D
 *     card loads, and wherever it cannot (no WebGL), the two faces are drawn
 *     flat in HTML with SVG codes, so the page reads and scans without it.
 *   - Everything: what can be used today in both products, each with its
 *     true status (the words the build checks).
 */
import { useEffect, useRef, useState } from 'react';
import { Pill, Rise, useSite } from './parts';
import { reviewQR, tableQR } from './qrdata';
import { BUSINESS, LANGS, POWERED, qrPath } from './cardfaces';
import type { CardHandle } from './card3d';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Qr({ rows, label }: { rows: string[]; label: string }) {
  const { d, size } = qrPath(rows);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#16181d" />
    </svg>
  );
}

function Stars() {
  return (
    <span className="v-pvc-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" />
        </svg>
      ))}
    </span>
  );
}

export function QrCard({ id = 'card' }: { id?: string }) {
  const { s, p } = useSite();
  const c = s.card;
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<CardHandle | null>(null);
  const [on, setOn] = useState(false);
  const [front, setFront] = useState(true);
  // without WebGL, the flat cards swap places instead
  const turn = () => {
    if (on) handle.current?.flip();
    else setFront((f) => !f);
  };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
    let dead = false;
    // three.js is fetched only as the card comes near the screen
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        void Promise.all([import('./cardfaces'), import('./card3d')]).then(async ([{ drawFaces }, { mountCard }]) => {
          // drawn at about the size the card shows at, times the screen's density
          const px = Math.round(el.clientWidth * 0.88 * Math.min(window.devicePixelRatio || 1, 2));
          const faces = await drawFaces({ frontLine: c.faceFrontLine, frontCall: c.faceFrontCall, backTable: c.faceBackTable, backCall: c.faceBackCall, backLine: c.faceBackLine }, Math.min(2048, Math.max(720, px)));
          if (dead) return;
          handle.current = mountCard(el, faces, { still: reduced(), onReady: () => setOn(true), onSide: setFront });
        });
      },
      { rootMargin: '500px 0px' },
    );
    io.observe(el);
    return () => {
      dead = true;
      io.disconnect();
      handle.current?.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id={id} className="v-sec v-alt">
      <div className="v-wrap">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="order-2 lg:order-1">
            <Rise>
              <Pill kind="built">{p.status.built}</Pill>
              <h2 className="v-h2 mt-4">{c.heading}</h2>
              <p className="v-lead">{c.lede}</p>
            </Rise>
            <div className="v-pvc-sides mt-8">
              <div id="review-card" data-on={front}>
                <h3 className="v-h3">{c.frontTitle}</h3>
                <p>{c.frontText}</p>
              </div>
              <div id="table-card" data-on={!front}>
                <h3 className="v-h3">{c.backTitle}</h3>
                <p>{c.backText}</p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div ref={host} className={`v-pvc ${on ? 'is-3d' : ''}`} role="img" aria-label={c.alt}>
              <div className={`v-pvc-flat ${front ? '' : 'is-back'}`} aria-hidden={on}>
                <div className="v-pvc-face v-pvc-back">
                  <div className="v-pvc-text">
                    <span className="v-pvc-biz">{BUSINESS}</span>
                    <span className="v-pvc-table">{c.faceBackTable}</span>
                    <span className="v-pvc-call">{c.faceBackCall}</span>
                    <span className="v-pvc-line">{c.faceBackLine}</span>
                    <span className="v-pvc-foot">{LANGS}</span>
                  </div>
                  <span className="v-pvc-qr">
                    <Qr rows={tableQR.rows} label={c.backTitle} />
                  </span>
                </div>
                <div className="v-pvc-face v-pvc-front">
                  <div className="v-pvc-text">
                    <span className="v-pvc-biz">{BUSINESS}</span>
                    <span className="v-pvc-big">{c.faceFrontLine}</span>
                    <Stars />
                    <span className="v-pvc-line">{c.faceFrontCall}</span>
                    <span className="v-pvc-foot">{POWERED}</span>
                  </div>
                  <span className="v-pvc-qr">
                    <Qr rows={reviewQR.rows} label={c.frontTitle} />
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="v-small m-0 min-h-[1.5em]">
                {on && <span>{c.hint} </span>}
                <span className="v-only-desk">{c.scan}</span>
              </p>
              <button type="button" className="v-btn-ghost" onClick={turn} aria-label={c.flip}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" />
                </svg>
                {c.flip}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Everything({ only }: { only?: 'growth' }) {
  const { t, s, p, href } = useSite();
  const e = s.everything;
  const growth = (
    <Rise className="v-list" delay={only ? 0 : 0.06}>
      <div className="v-list-head">
        <a href={href('growth')} className="v-h3 text-[22px]">
          {p.lineup.growth.name}
        </a>
        <Pill kind="built">{p.status.built}</Pill>
      </div>
      <div className={only ? 'v-list-cols two' : 'v-list-cols'}>
        {e.growth.map((x) => (
          <div key={x.t} className="v-list-row">
            <h3>{x.t}</h3>
            <p>{x.d}</p>
          </div>
        ))}
      </div>
    </Rise>
  );
  return (
    <section id="everything" className="v-sec v-white">
      <div className="v-wrap">
        <Rise>
          <h2 className="v-h2">{e.heading}</h2>
          <p className="v-lead">{e.lede}</p>
        </Rise>
        {only ? (
          <div className="mt-10">{growth}</div>
        ) : (
          <div className="v-grid2 mt-12 items-start">
            <Rise className="v-list">
              <div className="v-list-head">
                <a href={href('clinic')} className="v-h3 text-[22px]">
                  {p.lineup.clinic.name}
                </a>
                <Pill kind="live">{t.readiness.LIVE}</Pill>
              </div>
              <div className="v-list-cols">
                {e.clinic.map((x) => (
                  <div key={x.t} className="v-list-row">
                    <h3>
                      {x.t}
                      {x.trial && <Pill kind="trial">{p.status.trial}</Pill>}
                    </h3>
                    <p>{x.d}</p>
                  </div>
                ))}
              </div>
            </Rise>
            {growth}
          </div>
        )}
      </div>
    </section>
  );
}
