import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind classes beating earlier ones.
 *
 * Needed rather than plain template concatenation because a component
 * that hardcodes `px-4` and a caller that passes `px-2` would otherwise
 * both be emitted, and which one applies comes down to their order in the
 * stylesheet -- not the caller's intent.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
