import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A multi-line field.
 *
 * 16px on a coarse pointer, like Input: Safari zooms the viewport when a
 * field under 16px is focused and leaves it zoomed, which at a front desk
 * means every tap on a notes field jolts the layout.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border/15 bg-background px-3 py-2 text-sm",
        "ring-offset-background placeholder:text-muted-foreground/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[@media(pointer:coarse)]:text-base",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
