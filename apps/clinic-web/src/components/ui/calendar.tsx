import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The month grid, themed to this app.
 *
 * Styled through react-day-picker's own class names rather than its
 * stylesheet, so it follows the portal's light and dark themes from the
 * same tokens every other component uses.
 *
 * ── The alignment bug this file had, and why ─────────────────────────
 *
 * The first version put the previous/next arrows in `absolute` and made
 * `month_caption` the `relative` anchor. That is wrong, and rendering the
 * real DOM shows why: react-day-picker v9 emits
 *
 *     div.rdp-root
 *       div.rdp-months
 *         nav.rdp-nav            <- a SIBLING of the month, before it
 *         div.rdp-month
 *           div.rdp-month_caption
 *           table.rdp-month_grid
 *
 * so `nav` is not inside the caption at all. With no positioned ancestor
 * of its own it resolved against the popover, and the arrows landed
 * somewhere near the top of the panel instead of on the month label.
 * `months` is the element that actually contains it, so `months` is what
 * has to be `relative`.
 *
 * The second half: `month_grid` was `w-full` while the rows are flex
 * containers of seven fixed 36px cells. The table stretched to the panel
 * while its rows stayed 252px, so the grid sat left of a centred caption.
 * The table is now sized by its contents and the whole calendar is
 * `w-fit`, which makes the popover wrap it exactly.
 *
 * ── Two choices that are not cosmetic ────────────────────────────────
 *
 *   - Weeks start on MONDAY. An Indian clinic's week does, and its OPD
 *     register does, so a Sunday-first grid makes "how busy was last
 *     week" the wrong shape to read.
 *   - Today keeps its ring even when another day is selected. Looking at
 *     next Thursday while still seeing where today sits is the entire
 *     point of booking a follow-up.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** 7 x 36px. The weekday header and the day cells must use the SAME
 *  width or the columns drift -- which is the whole bug above. */
const CELL = "w-9";

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      weekStartsOn={1}
      className={cn("w-fit", className)}
      classNames={{
        root: "w-fit",
        // The positioning anchor for `nav`. See the note above.
        months: "relative flex flex-col gap-3",
        month: "flex flex-col gap-2",
        // Same height as the nav row, so the label and the arrows share a line.
        month_caption: "flex items-center justify-center h-8",
        caption_label: "text-sm font-semibold",
        nav: "absolute top-0 inset-x-0 h-8 flex items-center justify-between z-10",
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
        // Deliberately NOT w-full: the rows below are fixed-width flex
        // containers, and a stretched table leaves them misaligned.
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: cn(CELL, "h-8 flex items-center justify-center font-medium text-[11px] text-muted-foreground/70"),
        weeks: "",
        week: "flex",
        day: cn(CELL, "h-9 p-0 text-center align-middle"),
        day_button: cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs tabular-nums",
          "hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-primary/60 transition-colors",
        ),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold [&>button:hover]:bg-primary",
        today: "[&>button]:ring-1 [&>button]:ring-primary/50 [&>button]:font-semibold",
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
