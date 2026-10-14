import { useEffect, useMemo, useRef } from 'react';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The interaction layer of the website canvas.
 *
 * ── The architecture, and why it is this one ─────────────────────────
 *
 * The preview is an iframe showing the REAL public page, which is the
 * property worth protecting: a preview drawn by separate code is free to
 * disagree with what gets published. But a pointer that starts inside an
 * iframe keeps sending its events to that frame, so a drag begun on a
 * block and released over the builder's panels is lost halfway, and
 * HTML5 drag-and-drop across a frame boundary is worse again.
 *
 * So the frame publishes GEOMETRY -- where each block is, and how far it
 * is scrolled -- and this component draws an interaction surface over it
 * at the same coordinates. Hover, selection, the drag handle and the drop
 * indicator all live out here in the parent document, where the pointer
 * never crosses a boundary.
 *
 * This is the pattern the established builders use. GrapesJS runs its
 * canvas in an iframe and exposes the frame's rects to the editor;
 * Craft.js took its element-positioning from GrapesJS; Sanity's visual
 * editing states the rule plainly -- the overlay is for display and it
 * "does not mutate or reorder the DOM", it edits the structured content.
 *
 * That last point is the one that matters most here. A drag NEVER moves
 * a DOM node. It changes the section order in the builder's state, the
 * new order is posted into the frame, and the page re-renders itself.
 * The canvas therefore cannot drift from what will be published, because
 * it is not a rendering of the drag -- it is a rendering of the data the
 * drag produced.
 */

export interface BlockRect {
  key: string;
  /** Document coordinates inside the frame, before scroll or scale. */
  top: number;
  left: number;
  width: number;
  height: number;
}

export type DragSource = 'canvas' | 'palette';
export interface DragState {
  source: DragSource;
  key: string;
}

interface Props {
  blocks: BlockRect[];
  /** How far the frame is scrolled, so the overlay tracks it. */
  scrollY: number;
  /** The frame is rendered at a device width and scaled down to fit. */
  scale: number;
  /** Rendered size of the scaled frame, which the overlay matches. */
  width: number;
  height: number;

  /** Reorderable blocks, in their current order. Excludes the hero. */
  order: string[];
  selected: string | null;
  hidden: Set<string>;
  labelFor: (key: string) => string;

  drag: DragState | null;
  dropIndex: number | null;

  onSelect: (key: string) => void;
  onStartDrag: (drag: DragState) => void;
  onDropIndexChange: (index: number | null) => void;
  onCommit: () => void;
  onToggleHidden: (key: string) => void;
}

/** Blocks that are always on the page and cannot be moved or removed. */
const FIXED = new Set(['hero']);

export function CanvasOverlay({
  blocks, scrollY, scale, width, height,
  order, selected, hidden, labelFor,
  drag, dropIndex,
  onSelect, onStartDrag, onDropIndexChange, onCommit, onToggleHidden,
}: Props) {
  const surface = useRef<HTMLDivElement | null>(null);

  /** Overlay-space rect for a block: scrolled, then scaled. */
  const place = (b: BlockRect) => ({
    left: b.left * scale,
    top: (b.top - scrollY) * scale,
    width: b.width * scale,
    height: b.height * scale,
  });

  /**
   * The vertical midpoints of the draggable blocks, in overlay space, in
   * page order. The drop index is simply how many of them the pointer has
   * passed -- which is why they must be sorted by position and not by the
   * order the frame happened to report them in.
   */
  const dropLines = useMemo(() => {
    const byKey = new Map(blocks.map((b) => [b.key, b]));
    return order
      .map((key) => {
        const b = byKey.get(key);
        if (!b) return null;
        const p = place(b);
        return { key, top: p.top, mid: p.top + p.height / 2, bottom: p.top + p.height };
      })
      .filter((x): x is { key: string; top: number; mid: number; bottom: number } => x !== null);
    // place() depends on scale and scrollY, both of which are in the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, order, scale, scrollY]);

  /**
   * Pointer tracking for the whole drag, on the window.
   *
   * On the window rather than on the overlay because a drag that leaves
   * the canvas -- over the panel, or off the top -- must still be
   * tracked and must still end. A listener on the surface would simply
   * stop firing and leave the drag stuck on.
   */
  useEffect(() => {
    if (!drag) return;

    const onMove = (event: PointerEvent) => {
      const box = surface.current?.getBoundingClientRect();
      if (!box) return;
      const y = event.clientY - box.top;
      // Outside the canvas: no drop target, and the indicator disappears
      // rather than sticking to the last place it saw.
      if (event.clientX < box.left || event.clientX > box.right || y < 0 || y > box.height) {
        onDropIndexChange(null);
        return;
      }
      let index = 0;
      for (const line of dropLines) {
        if (y > line.mid) index += 1;
      }
      onDropIndexChange(index);
    };

    const onUp = () => onCommit();
    // Escape abandons the drag, which is what every drag in every tool
    // does and what someone reaches for when they have picked up the
    // wrong block.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDropIndexChange(null);
        onCommit();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag, dropLines, onDropIndexChange, onCommit]);

  /** Where to draw the horizontal line showing where the block will land. */
  const indicatorTop = (() => {
    if (dropIndex === null || !drag) return null;
    if (dropLines.length === 0) return 0;
    if (dropIndex <= 0) return dropLines[0]!.top;
    const before = dropLines[Math.min(dropIndex, dropLines.length) - 1]!;
    return before.bottom;
  })();

  return (
    <div
      ref={surface}
      className="absolute inset-0 overflow-hidden"
      style={{ width, height }}
      // While dragging, the surface must keep receiving the pointer even
      // over a child, or the move events stop at the box being dragged.
      onPointerDown={(e) => {
        // A click on bare canvas clears the selection, as in any editor.
        if (e.target === surface.current) onSelect('');
      }}
    >
      {blocks.map((b) => {
        const p = place(b);
        // Entirely scrolled out of view: nothing to draw, and drawing it
        // anyway would put invisible hit-boxes over the panels.
        if (p.top + p.height < 0 || p.top > height) return null;

        const isSelected = selected === b.key;
        const isFixed = FIXED.has(b.key);
        const isDragging = drag?.source === 'canvas' && drag.key === b.key;
        const isHidden = hidden.has(b.key);

        return (
          <div
            key={b.key}
            onPointerDown={(e) => {
              e.preventDefault();
              onSelect(b.key);
            }}
            className={cn(
              'absolute group transition-colors',
              // The block itself stays clickable in the frame underneath
              // for anything we are not handling, so the surface only
              // claims the pointer where it draws something.
              'cursor-pointer',
              isDragging && 'opacity-40',
            )}
            style={{ ...p }}
          >
            {/* The outline. Drawn inside the box so a block flush against
                the viewport edge is not clipped by the surface. */}
            <div
              className={cn(
                'absolute inset-0 pointer-events-none border-2 transition-colors rounded-[2px]',
                isSelected
                  ? 'border-primary'
                  : 'border-transparent group-hover:border-primary/40',
              )}
            />

            {/* The name tag, as in every visual editor: it is how you know
                what you are about to move before you move it. */}
            <div
              className={cn(
                'absolute -top-px left-0 flex items-center gap-1 px-1.5 h-5 rounded-b text-[10px] font-medium whitespace-nowrap',
                'transition-opacity',
                isSelected
                  ? 'bg-primary text-primary-foreground opacity-100'
                  : 'bg-primary/80 text-primary-foreground opacity-0 group-hover:opacity-100',
              )}
            >
              {!isFixed && (
                <span
                  // The handle starts the drag; the rest of the block only
                  // selects. Dragging from anywhere would make it
                  // impossible to click a block without nudging it.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(b.key);
                    onStartDrag({ source: 'canvas', key: b.key });
                  }}
                  className="cursor-grab active:cursor-grabbing -ml-0.5"
                  title={`Drag to move ${labelFor(b.key)}`}
                >
                  <GripVertical size={11} />
                </span>
              )}
              {labelFor(b.key)}
              {isFixed && <span className="opacity-70">· always on</span>}
              {!isFixed && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHidden(b.key);
                  }}
                  title={isHidden ? 'Show this block' : 'Hide this block'}
                  className="ml-0.5 opacity-80 hover:opacity-100"
                >
                  {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Where it will land. A line between blocks, not a box around one:
          the question during a drag is "between which two", and a
          highlighted block answers a different question. */}
      {indicatorTop !== null && (
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: Math.max(0, Math.min(indicatorTop, height - 2)) }}
        >
          <div className="h-0.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
          <div className="absolute -top-1 -left-0.5 w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
