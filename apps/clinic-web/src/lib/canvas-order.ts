/**
 * Turning "dropped here on the canvas" into a new section order.
 *
 * Extracted from the builder because this is the part that is easy to get
 * subtly wrong and impossible to eyeball: an off-by-one appears in one
 * drag direction only, so the block lands correctly half the time and one
 * slot out the other half, which reads as the canvas being jittery rather
 * than as a bug.
 *
 * Two lists are in play and they are not the same:
 *
 *   - `sections` -- everything, in order, including the hidden ones.
 *     This is the data that gets saved.
 *   - the VISIBLE blocks -- only those actually drawn on the page, which
 *     is all the canvas can see or measure.
 *
 * The canvas can only report an index among the blocks it drew. So that
 * index is turned into "before which visible block", and that block is
 * then located in the real list.
 */

export interface Orderable {
  key: string;
  enabled: boolean;
}

/**
 * Move `key` to sit immediately before `anchorKey`, or last when the
 * anchor is null (dropped past the final block).
 */
export function moveBefore<T extends Orderable>(list: T[], key: string, anchorKey: string | null): T[] {
  const item = list.find((s) => s.key === key);
  if (!item) return list;
  const rest = list.filter((s) => s.key !== key);
  if (anchorKey === null) return [...rest, item];
  const i = rest.findIndex((s) => s.key === anchorKey);
  return i < 0 ? [...rest, item] : [...rest.slice(0, i), item, ...rest.slice(i)];
}

/** The keys actually drawn on the page, in page order. */
export function visibleKeys<T extends Orderable>(list: T[]): string[] {
  return list.filter((s) => s.enabled).map((s) => s.key);
}

/**
 * Which visible block a dragged block should land before.
 *
 * `dropIndex` counts the visible blocks the pointer has passed. For a
 * drag that began ON the canvas, the dragged block is itself one of those
 * blocks, so once the pointer is past its own midpoint every later index
 * is one too high -- hence the correction. A drag from the palette is not
 * yet on the page, so there is nothing to correct for.
 */
export function anchorForDrop(
  visible: string[],
  draggedKey: string,
  dropIndex: number,
  source: 'canvas' | 'palette',
): string | null {
  if (source === 'palette') return visible[dropIndex] ?? null;
  const draggedAt = visible.indexOf(draggedKey);
  const without = visible.filter((k) => k !== draggedKey);
  const target = draggedAt >= 0 && dropIndex > draggedAt ? dropIndex - 1 : dropIndex;
  return without[target] ?? null;
}

/**
 * The whole commit, as one pure function.
 *
 * Returns the list unchanged when the drop would not move anything, so a
 * click that is read as a one-pixel drag does not mark the form dirty.
 */
export function applyDrop<T extends Orderable>(
  list: T[],
  draggedKey: string,
  dropIndex: number,
  source: 'canvas' | 'palette',
): T[] {
  const enabled = source === 'palette'
    ? list.map((s) => (s.key === draggedKey ? { ...s, enabled: true } : s))
    : list;

  const visible = visibleKeys(source === 'palette' ? list : enabled);
  const anchor = anchorForDrop(visible, draggedKey, dropIndex, source);

  // Dropping a block onto itself is not a move.
  if (anchor === draggedKey) return list;

  const next = moveBefore(enabled, draggedKey, anchor);
  // Nothing actually changed: same order, same visibility.
  const same =
    next.length === list.length &&
    next.every((s, i) => s.key === list[i]!.key && s.enabled === list[i]!.enabled);
  return same ? list : next;
}
