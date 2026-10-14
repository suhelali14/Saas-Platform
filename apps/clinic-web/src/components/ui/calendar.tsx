import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The month grid, themed to this app.
 *
 * Styled through react-day-picker's own class names rather than a
 * stylesheet, so it follows the portal's light and dark themes from the
 * same tokens every other component uses.
 *
 * Two choices worth stating, because a clinic calendar is not a blog
 * calendar:
 *
 *   - Weeks start on MONDAY. An Indian clinic's week does, the OPD
 *     register does, and a Sunday-first grid makes "how busy was last
 *     week" the wrong shape to read.
 *   - Today is always marked, even when another day is selected. Looking
 *     at next Thursday while knowing where today sits is the whole point
 *     of booking a follow-up.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col gap-3",
        month: "flex flex-col gap-3",
        month_caption: "flex items-center justify-center h-8 relative",
        caption_label: "text-sm font-semibold",
        nav: "flex items-center justify-between absolute inset-x-1 top-1 z-10",
        button_previous: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-lg",
          "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
          "disabled:opacity-30 disabled:pointer-events-none transition-colors",
        ),
        button_next: cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-lg",
          "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
          "disabled:opacity-30 disabled:pointer-events-none transition-colors",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[11px] font-medium text-muted-foreground/70",
        week: "flex w-full mt-1",
        day: "w-9 h-9 p-0 text-center",
        day_button: cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs tabular-nums",
          "hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-emerald-400/60 transition-colors",
        ),
        selected: "[&>button]:bg-emerald-500 [&>button]:text-white [&>button]:font-semibold [&>button:hover]:bg-emerald-500",
        today: "[&>button]:ring-1 [&>button]:ring-emerald-400/50 [&>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground/30",
        disabled: "[&>button]:text-muted-foreground/20 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? <ChevronLeft size={15} {...rest} /> : <ChevronRight size={15} {...rest} />,
      }}
      {...props}
    />
  );
}
