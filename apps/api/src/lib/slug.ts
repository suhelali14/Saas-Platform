import { randomUUID } from "node:crypto";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A URL-friendly slug with a random suffix, so two businesses named the
 * same thing don't collide on Business.slug's unique constraint. */
export function uniqueSlug(text: string): string {
  return `${slugify(text)}-${randomUUID().slice(0, 6)}`;
}
