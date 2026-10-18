/**
 * The shared vocabulary for this app's screens.
 *
 * Re-exported from one place so a screen imports what it needs in a
 * single line, and so there is an obvious answer to "is there already a
 * component for this?" -- the question whose absence produces a sixth
 * hand-rolled card.
 *
 * `Button` deliberately lives in ../Button and not here: it carries
 * behaviour (it manages its own pending state from a promise-returning
 * onClick), and it already has fifteen call sites that must keep working.
 * One button, one import path.
 */
export { Badge, badgeVariants } from './badge';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardStat, CardTitle, cardVariants } from './card';
export {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from './dialog';
export { Input } from './input';
export { Label } from './label';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
export { Separator } from './separator';
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Textarea } from './textarea';
/*
 * `Calendar` is deliberately NOT re-exported here.
 *
 * It carries react-day-picker and date-fns, and a barrel is imported by
 * eager modules -- which is exactly how that library ended up in the
 * startup chunk for every visitor. Use `<DatePicker>`, which is the
 * component you actually want anyway: it owns the value contract and
 * loads the grid on first open. Reach for `./calendar` directly only if
 * you are building something that is not a date field.
 */
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './popover';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
