import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities winning over earlier
 * conflicting ones.
 *
 * Plain string concatenation does not do this: "p-2" and "p-4" would both
 * land in the class list and the winner would depend on stylesheet order,
 * not on the caller's intent. twMerge resolves the conflict so a variant
 * can be overridden at the call site, which is the whole reason the
 * component API takes a className at all.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
