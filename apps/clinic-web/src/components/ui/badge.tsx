import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status chips.
 *
 * Visual weight follows the exception, not the norm. A LIVE clinic is
 * the expected state and gets a quiet treatment; SUSPENDED and a failed
 * health check are what should catch the eye when scanning a list of
 * fifty. Making every row shout defeats the purpose of colour.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-ink-success/25 bg-ink-success/10 text-ink-success",
        warning: "border-ink-warning/25 bg-ink-warning/10 text-ink-warning",
        destructive: "border-ink-danger/25 bg-ink-danger/10 text-ink-danger",
        primary: "border-primary/25 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
