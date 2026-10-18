import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CANVAS_WIDTH, inPaintOrder, type Breakpoint, type CanvasDoc, type CanvasNode } from '../lib/canvas-doc';
import { publicAsset } from '../lib/public-site';

/**
 * The published free-canvas page.
 *
 * ── How a fixed canvas meets an unknown screen ──────────────────────
 *
 * Nodes are positioned in plain pixels inside a fixed design width, so
 * the page has to decide what to do on a viewport that is not that width.
 * Three behaviours, and the thresholds are the point:
 *
 *   >= 1200px   the desktop layout at 1:1, centred. What was arranged is
 *               exactly what is served.
 *   768..1200   the desktop layout scaled down proportionally. Everything
 *               keeps its relative position and its proportions; the
 *               whole page just gets smaller, which is faithful and
 *               predictable. Re-flowing instead would move things the
 *               clinic deliberately placed.
 *   < 768px     the phone layout, scaled to the viewport width.
 *
 * Scaling with a transform rather than by recomputing every value: one
 * multiplication applied once by the compositor, and no chance of the
 * published page's arithmetic drifting from the editor's.
 *
 * The wrapper's height has to be set explicitly, because `transform` does
 * not affect layout -- a scaled 4000px page still reserves 4000px and
 * leaves a long blank gap underneath it otherwise. That gap is the single
 * most common bug in a scaled canvas and it is invisible until someone
 * scrolls.
 */

/** Below this, the phone layout. Chosen to match Tailwind's `md`, which is
 *  the breakpoint the rest of this site already thinks in. */
const PHONE_BELOW = 768;

function useBreakpoint(): { bp: Breakpoint; scale: number } {
  const [state, setState] = useState<{ bp: Breakpoint; scale: number }>(() => measure());

  useEffect(() => {
    const onResize = () => setState(measure());
    window.addEventListener('resize', onResize);
    // Rotating a phone fires resize on every browser worth supporting, so
    // there is no need for a second orientation listener.
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return state;
}

function measure(): { bp: Breakpoint; scale: number } {
  // Guard for a server or a test environment with no window.
  const width = typeof window === 'undefined' ? CANVAS_WIDTH.desktop : window.innerWidth;
  if (width < PHONE_BELOW) {
    return { bp: 'mobile', scale: width / CANVAS_WIDTH.mobile };
  }
  return { bp: 'desktop', scale: Math.min(1, width / CANVAS_WIDTH.desktop) };
}

interface Props {
  doc: CanvasDoc;
  /** Renders a clinic-content block. Supplied by the page that owns the
   *  clinic's data, so this component never fetches and never knows how a
   *  section is built. */
  renderSection: (key: string) => ReactNode;
}

export function CanvasPage({ doc, renderSection }: Props) {
  const { bp, scale } = useBreakpoint();
  const width = CANVAS_WIDTH[bp];
  const height = doc.height[bp];

  return (
    <div
      className="relative mx-auto overflow-hidden"
      style={{
        // The scaled footprint, so the document flows correctly after it.
        width: width * scale,
        height: height * scale,
        background: doc.background,
      }}
    >
      <div
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        {inPaintOrder(doc).map((node) => (
          <CanvasNodeView key={node.id} node={node} bp={bp} renderSection={renderSection} />
        ))}
      </div>
    </div>
  );
}

/**
 * One node.
 *
 * Exported because the editor renders the same component inside its
 * canvas. A preview drawn by separate code is free to disagree with what
 * gets published, which is the one thing a preview must never do.
 */
export function CanvasNodeView({
  node,
  bp,
  renderSection,
}: {
  node: CanvasNode;
  bp: Breakpoint;
  renderSection: (key: string) => ReactNode;
}) {
  const g = node.at[bp];
  const p = node.props;

  const box: CSSProperties = {
    position: 'absolute',
    left: g.x,
    top: g.y,
    width: g.w,
    height: g.h,
  };

  const type: CSSProperties = {
    fontSize: p.fontSize,
    fontWeight: p.fontWeight,
    textAlign: p.align,
    color: p.color,
    lineHeight: p.lineHeight,
  };

  switch (node.type) {
    case 'heading':
      return (
        // h2 rather than h1: the page's own hero owns the h1, and two of
        // them is a real accessibility defect, not a nitpick -- a screen
        // reader's heading list becomes meaningless.
        <h2
          style={{ ...box, ...type, margin: 0, fontFamily: 'var(--heading-font)' }}
          className="whitespace-pre-wrap"
        >
          {p.text}
        </h2>
      );

    case 'text':
      return (
        // `whitespace-pre-wrap`, so the line breaks someone typed are the
        // line breaks they get. Set as text and never as HTML: a clinic
        // admin pasting from a word processor must not be able to inject
        // markup into a page patients read.
        <p style={{ ...box, ...type, margin: 0 }} className="whitespace-pre-wrap">
          {p.text}
        </p>
      );

    case 'button': {
      const style: CSSProperties = {
        ...box,
        ...type,
        background: p.background,
        borderRadius: p.radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: p.align === 'left' ? 'flex-start' : p.align === 'right' ? 'flex-end' : 'center',
        padding: p.padding ?? 12,
        textDecoration: 'none',
      };
      // An external link gets the noopener pair. Without it the opened page
      // can reach back through window.opener and navigate this one.
      const external = !!p.href && /^https?:/i.test(p.href);
      return p.href ? (
        <a
          href={p.href}
          style={style}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {p.text}
        </a>
      ) : (
        <span style={style}>{p.text}</span>
      );
    }

    case 'image':
      return p.src ? (
        <img
          src={publicAsset(p.src)}
          alt={p.alt ?? ''}
          style={{ ...box, borderRadius: p.radius, objectFit: 'cover' }}
          // The geometry already reserves the space, so there is nothing
          // to shift -- but width/height still let the browser decode at
          // the right size instead of scaling a full-resolution upload.
          width={g.w}
          height={g.h}
          loading="lazy"
        />
      ) : (
        // An empty image placeholder is drawn only in the editor. On the
        // published page it renders nothing, because a patient should see
        // the clinic's site rather than evidence of an unfinished one.
        null
      );

    case 'box':
      return <div style={{ ...box, background: p.background, borderRadius: p.radius }} />;

    case 'divider':
      return <div style={{ ...box, background: p.background ?? 'currentColor', opacity: p.background ? 1 : 0.15 }} />;

    case 'bound':
      return (
        // `overflow-hidden` because the clinic sized this box and the real
        // content may be taller than it -- a section spilling over the
        // next one looks broken, whereas a clipped one looks tight. The
        // editor shows the same clipping, so it is visible while editing
        // rather than discovered after publishing.
        <div style={box} className="overflow-hidden">
          {renderSection(p.bind!)}
        </div>
      );

    default:
      return null;
  }
}
