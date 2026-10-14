import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The card.
 *
 * ── Why this grew variants ───────────────────────────────────────────
 *
 * An audit found 55 hand-rolled card surfaces across the portal and
 * `<Card>` imported in two files. That is not laziness: the component
 * only offered one look -- a solid `bg-card` panel -- and most of those
 * 55 needed the quieter inset surface (`bg-foreground/[0.02]`) that sits
 * INSIDE a panel, or a row that responds to a hover because it is
 * clickable. Having no variant for the common case is what produces a
 * fifty-sixth hand-rolled div.
 *
 * So the variants are named after the jobs those 55 were doing:
 *
 *   - `panel`    a top-level container on a page (the old default)
 *   - `subtle`   an inset surface within a panel -- the most common
 *   - `ghost`    no ground at all, border only, for a dense list
 *   - `stat`     a figure tile, where the number is the content
 *
 * `interactive` is separate from the look because any variant can be
 * clickable. It adds the hover and focus affordance and nothing else.
 *
 * ── The one rule that is not cosmetic ────────────────────────────────
 *
 * Nothing here colours itself by meaning. Status lives in a Badge, and
 * a clinical accent (an allergy banner, a priority tier) is deliberately
 * not a card variant -- those colours carry information and must not be
 * reachable by choosing a container style. See DESIGN.md: visual weight
 * follows the exception, not the norm.
 */

const cardVariants = cva("rounded-xl text-card-foreground", {
  variants: {
    variant: {
      // A soft, wide shadow rather than a hard border is what makes a
      // card read as floating on the blue-grey ground, which is the whole
      // look of the reference design. Kept very low opacity: on a dense
      // clinical screen a heavy shadow under every panel turns into mud.
      panel: "border border-border/10 bg-card shadow-[0_2px_12px_-4px_hsl(215_55%_18%_/_0.10)]",
      subtle: "border border-border/10 bg-foreground/[0.02]",
      ghost: "border border-border/10",
      stat: "border border-border/10 bg-foreground/[0.02]",
    },
    interactive: {
      // A real focus ring, because these become buttons and links and a
      // keyboard user has to be able to see where they are.
      true: "transition-colors cursor-pointer hover:border-border/30 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
      false: "",
    },
  },
  defaultVariants: { variant: "panel", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
  ),
);
Card.displayName = "Card";

/**
 * Padding is a prop rather than a fixed p-5.
 *
 * The portal has dense screens that are scanned (a queue, a ledger) and
 * roomy ones that are read (settings, a form). A single padding forced
 * every dense surface to override it, which is the other half of why
 * those 55 divs exist.
 */
const pad = cva("", {
  variants: {
    size: { none: "p-0", sm: "p-3", md: "p-4", lg: "p-5" },
  },
  defaultVariants: { size: "lg" },
});

type PadProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof pad>;

const CardHeader = React.forwardRef<HTMLDivElement, PadProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1", pad({ size }), className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, PadProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn(pad({ size }), "pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, PadProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2", pad({ size }), "pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

/**
 * A figure and its label.
 *
 * Extracted because a stat tile is the single most repeated shape in the
 * portal and every copy of it made the same two choices badly: the label
 * competing with the number for weight, and the number set in a
 * proportional face so a changing figure jitters. `tabular-nums` fixes
 * the second; the type ramp fixes the first.
 */
export interface StatProps extends Omit<CardProps, "variant"> {
  label: string;
  value: React.ReactNode;
  /** A unit or qualifier, set quieter than the figure. */
  hint?: string;
  icon?: React.ReactNode;
}

const CardStat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ className, label, value, hint, icon, ...props }, ref) => (
    <Card ref={ref} variant="stat" className={cn("p-4", className)} {...props}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {label}
        </span>
        {icon && <span className="shrink-0 text-muted-foreground/50" aria-hidden>{icon}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums leading-none">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/70">{hint}</div>}
    </Card>
  ),
);
CardStat.displayName = "CardStat";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardStat,
  cardVariants,
};
