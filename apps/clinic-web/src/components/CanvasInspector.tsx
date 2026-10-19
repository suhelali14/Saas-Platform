import {
  ArrowDown, ArrowUp, Copy, Smartphone, Trash2, Unlink,
} from 'lucide-react';
import {
  CANVAS_WIDTH, NODE_DEFAULTS,
  type Breakpoint, type CanvasNode, type Geometry, type NodeProps,
} from '../lib/canvas-doc';
import { sectionLabel } from '../lib/canvas-blocks';

/**
 * The panel for the selected block.
 *
 * ── Written for someone who has never built a website ───────────────
 *
 * The free canvas was the owner's explicit choice, so every lever is
 * here. What is NOT here is jargon: the fields say "Across" and "Down"
 * rather than X and Y, "From the top" rather than offset, and the
 * typography section says "Size" rather than font-size. A doctor who has
 * never opened a design tool has no reason to know which of x and y is
 * horizontal, and getting it wrong moves their page in a direction they
 * did not expect -- which is how someone decides the tool is broken.
 *
 * Numbers are also editable as numbers. Dragging is how you place
 * something roughly; typing 0 into "Across" is how you line two things up
 * exactly, and a canvas without that forces people to fight the snap.
 */

export interface GalleryPhoto {
  id: string;
  caption: string | null;
  storagePath: string;
}

interface Props {
  node: CanvasNode;
  bp: Breakpoint;
  /** The clinic's uploaded photos, for the picture picker. */
  photos: GalleryPhoto[];
  /** Turns a stored path into something an <img> can load. */
  assetUrl: (storagePath: string) => string;
  onGeometry: (patch: Partial<Geometry>) => void;
  onProps: (patch: Partial<NodeProps>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onForward: () => void;
  onBackward: () => void;
  onUnpinMobile: () => void;
}

export function CanvasInspector({
  node, bp, photos, assetUrl,
  onGeometry, onProps, onDelete, onDuplicate, onForward, onBackward, onUnpinMobile,
}: Props) {
  const g = node.at[bp];
  const p = node.props;
  const isText = node.type === 'heading' || node.type === 'text' || node.type === 'button';
  const label = node.type === 'bound'
    ? sectionLabel(p.bind ?? '')
    : NODE_DEFAULTS[node.type].label;

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{label}</span>
        <div className="flex items-center gap-0.5">
          <IconBtn title="Bring forward" onClick={onForward}><ArrowUp size={13} /></IconBtn>
          <IconBtn title="Send backward" onClick={onBackward}><ArrowDown size={13} /></IconBtn>
          <IconBtn title="Make a copy" onClick={onDuplicate}><Copy size={13} /></IconBtn>
          <IconBtn title="Delete this block" onClick={onDelete} danger><Trash2 size={13} /></IconBtn>
        </div>
      </div>

      {/* A block moved by hand on the phone layout stops following the
          desktop one. That is correct, and it is also surprising later --
          so it is stated here, with the way back. */}
      {bp === 'mobile' && node.pinned?.mobile && (
        <div className="tone-info tone-block rounded-lg p-2.5 leading-relaxed">
          <p className="flex items-center gap-1.5 font-medium">
            <Smartphone size={12} aria-hidden /> Placed by hand on phones
          </p>
          <p className="mt-1 opacity-90">
            This block keeps the position you gave it here, and no longer follows the
            desktop layout.
          </p>
          <button
            type="button"
            onClick={onUnpinMobile}
            className="mt-2 inline-flex items-center gap-1.5 font-medium underline hover:no-underline"
          >
            <Unlink size={11} aria-hidden /> Follow the desktop layout again
          </button>
        </div>
      )}

      {node.type === 'bound' ? (
        <Group title="Content">
          <p className="text-muted-foreground leading-relaxed">
            This block shows your real {label.toLowerCase()}. It stays up to date on its
            own — there is nothing to type here, and nothing to keep in step by hand.
          </p>
          <Field label="Heading shown above it">
            <input
              className={INPUT}
              value={p.text ?? ''}
              placeholder="Leave blank for the usual heading"
              onChange={(e) => onProps({ text: e.target.value })}
            />
          </Field>
        </Group>
      ) : null}

      {isText && (
        <Group title={node.type === 'button' ? 'Button' : 'Words'}>
          <Field label={node.type === 'button' ? 'Label' : 'Text'}>
            <textarea
              className={`${INPUT} min-h-[64px] resize-y`}
              value={p.text ?? ''}
              onChange={(e) => onProps({ text: e.target.value })}
            />
          </Field>
          {node.type === 'button' && (
            <Field
              label="Where it goes"
              hint="A page on this site (/blog), a phone number (tel:+919000000000), or a full https:// address."
            >
              <input
                className={INPUT}
                value={p.href ?? ''}
                placeholder="tel:+91…"
                onChange={(e) => onProps({ href: e.target.value })}
              />
            </Field>
          )}
        </Group>
      )}

      {node.type === 'image' && (
        <Group title="Picture">
          {/*
            The actual picker. This panel used to say "pictures are chosen
            from the ones you have uploaded under Gallery" and then offer no
            way to choose one -- so an image block took up space on the page
            and could never display anything, because the renderer draws
            nothing without a `src`. A sentence describing a control is not
            a control.
          */}
          {photos.length === 0 ? (
            <p className="leading-relaxed text-muted-foreground">
              You have not uploaded any photos yet. Add them under Website →
              Photo Gallery, and they will appear here to choose from.
            </p>
          ) : (
            <>
              <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                {photos.map((ph) => {
                  const chosen = p.src === ph.storagePath;
                  return (
                    <button
                      key={ph.id}
                      type="button"
                      title={ph.caption ?? 'Use this picture'}
                      onClick={() => onProps({ src: ph.storagePath })}
                      className={`relative aspect-square overflow-hidden rounded-md border-2 transition-colors ${
                        chosen ? 'border-primary' : 'border-transparent hover:border-primary/40'
                      }`}
                    >
                      <img
                        src={assetUrl(ph.storagePath)}
                        alt={ph.caption ?? ''}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
              {p.src && (
                <button
                  type="button"
                  onClick={() => onProps({ src: undefined })}
                  className="self-start text-[10px] text-muted-foreground/70 underline hover:text-foreground"
                >
                  Use no picture
                </button>
              )}
            </>
          )}

          <Field
            label="Description for screen readers"
            hint="What the picture shows. Leave blank if it is decoration only."
          >
            <input
              className={INPUT}
              value={p.alt ?? ''}
              onChange={(e) => onProps({ alt: e.target.value })}
            />
          </Field>
        </Group>
      )}

      <Group title="Position and size">
        <div className="grid grid-cols-2 gap-2">
          <Num label="Across" value={g.x} max={CANVAS_WIDTH[bp]} onChange={(x) => onGeometry({ x })} />
          <Num label="From the top" value={g.y} max={40000} onChange={(y) => onGeometry({ y })} />
          <Num label="Width" value={g.w} min={24} max={CANVAS_WIDTH[bp]} onChange={(w) => onGeometry({ w })} />
          <Num label="Height" value={g.h} min={16} max={40000} onChange={(h) => onGeometry({ h })} />
        </div>
      </Group>

      {(isText || node.type === 'bound') && (
        <Group title="Type">
          <div className="grid grid-cols-2 gap-2">
            <Num label="Size" value={p.fontSize ?? 16} min={8} max={200} onChange={(fontSize) => onProps({ fontSize })} />
            <Field label="Weight">
              <select
                className={INPUT}
                value={p.fontWeight ?? 400}
                onChange={(e) => onProps({ fontWeight: Number(e.target.value) })}
              >
                <option value={400}>Normal</option>
                <option value={500}>Medium</option>
                <option value={600}>Semibold</option>
                <option value={700}>Bold</option>
              </select>
            </Field>
          </div>
          <Field label="Line up">
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => onProps({ align: a })}
                  className={`flex-1 rounded-md px-2 py-1.5 capitalize transition-colors ${
                    (p.align ?? 'left') === a
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-foreground/5 hover:bg-foreground/10'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
        </Group>
      )}

      <Group title="Colour">
        <Colour label="Text" value={p.color} onChange={(color) => onProps({ color })} />
        <Colour label="Background" value={p.background} onChange={(background) => onProps({ background })} />
        {/* Stated rather than enforced: the owner chose a free canvas, so
            this is a warning and not a block. It is here because a doctor
            picking two colours they like is the normal way a page ends up
            with grey text on a white ground, and they will not find out
            from their own screen. */}
        <p className="text-muted-foreground leading-relaxed">
          Keep text and background far apart in darkness, or the words get hard to read
          on a phone outdoors.
        </p>
      </Group>

      {node.type !== 'divider' && (
        <Group title="Shape">
          <div className="grid grid-cols-2 gap-2">
            <Num label="Corner round" value={p.radius ?? 0} min={0} max={400} onChange={(radius) => onProps({ radius })} />
            <Num label="Inner space" value={p.padding ?? 0} min={0} max={200} onChange={(padding) => onProps({ padding })} />
          </div>
        </Group>
      )}
    </div>
  );
}

const INPUT =
  'w-full rounded-md bg-foreground/5 border border-border/10 px-2 py-1.5 text-xs outline-none ' +
  'focus-visible:border-primary transition-colors';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/70 leading-relaxed">{hint}</span>}
    </label>
  );
}

/**
 * A number field that tolerates being emptied.
 *
 * `Number('')` is 0, so a naive handler snaps the value to zero the moment
 * someone selects all and starts retyping -- and the block jumps to the
 * top-left corner mid-edit. Blank is held as blank and only committed when
 * it parses.
 */
function Num({
  label, value, min = -9999, max = 9999, onChange,
}: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={INPUT}
        value={Math.round(value)}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value === '') return;
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </Field>
  );
}

/**
 * A colour, with a way back to "not set".
 *
 * A native colour input has no empty state -- it always reports something,
 * so once it is touched a block can never return to inheriting the site's
 * own palette. The Clear button is that way back, and it matters because
 * inheriting is the right answer for most blocks.
 */
function Colour({
  label, value, onChange,
}: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-muted-foreground">{label}</span>
      {value ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-[10px] text-muted-foreground/70 underline hover:text-foreground"
        >
          Clear
        </button>
      ) : (
        <span className="text-[10px] text-muted-foreground/50">From the site</span>
      )}
      <input
        type="color"
        aria-label={label}
        value={value ?? '#3b82f6'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 shrink-0 cursor-pointer rounded border border-border/20 bg-transparent p-0.5"
      />
    </div>
  );
}

function IconBtn({
  children, title, onClick, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        danger
          ? 'text-muted-foreground hover:bg-ink-danger/15 hover:text-ink-danger'
          : 'text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
