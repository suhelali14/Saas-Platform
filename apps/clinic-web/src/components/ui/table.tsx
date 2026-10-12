import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A data table.
 *
 * `Table` brings its own horizontal scroll container, rather than leaving
 * each caller to remember one. Every table in this app already had to be
 * wrapped in `overflow-x-auto` with an explicit min-width -- a queue of
 * today's patients has eight columns and does not fit a 375px phone --
 * and an audit of every `<table>` against its wrapper was needed to
 * confirm none had been missed. Putting the wrapper here means the next
 * table cannot miss it.
 *
 * Pass `minWidth` to set where scrolling starts. The default suits a
 * five-or-six column table; a wider one should say so.
 *
 * These screens are scanned, not read: rows are dense and the header is
 * quiet, so the eye lands on the data rather than on the chrome.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { minWidth?: string }
>(({ className, minWidth = "640px", ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      style={{ minWidth }}
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border/10", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/10 transition-colors hover:bg-accent/40 data-[state=selected]:bg-accent",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        // Quiet on purpose. Visual weight belongs to the exception, not
        // to the label that is on every row.
        "h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-3 py-2.5 align-middle", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
