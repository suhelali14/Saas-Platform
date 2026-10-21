/**
 * The service chart: every kind of business, with its real status.
 *
 * This section is why the whole site is a chart. Twenty-three rows where one
 * is in production cannot go on a page as a feature grid without lying, and a
 * chart with a status column is how this audience already reads exactly that
 * kind of list. The status is load-bearing copy, not styling.
 *
 * A real <table>, so it is one thing for a screen reader, a crawler and a
 * person: rows, columns, and a detail row that opens underneath.
 */
import { useId, useState } from 'react';
import { useContent } from '@/content/use-content';
import { serviceRows, groupOrder, type Readiness } from '@/content/structure';
import { Band, BandItem, Heading, Panel, Stamp, Caret, cx } from '@/components/primitives';

const STATUS_CELL: Record<Readiness, string> = {
  LIVE: 'cell-serving',
  BUILDING: 'cell-waiting',
  WAITLIST: 'cell-done',
};

const COUNTS = (['LIVE', 'BUILDING', 'WAITLIST'] as Readiness[]).map((status) => ({
  status,
  n: serviceRows.filter((r) => r.status === status).length,
}));

export function ServiceChart() {
  const { servicePanel, services, groups, readiness, readinessMeaning } = useContent();
  const [group, setGroup] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();

  const rows = group === 'all' ? serviceRows : serviceRows.filter((s) => s.group === group);

  return (
    <section id="services" className="frame void">
      <Panel>
        <Band>
          <BandItem>{servicePanel.bandTitle}</BandItem>
          <BandItem>
            <span data-figures>{serviceRows.length}</span> {servicePanel.rows}
          </BandItem>
          <BandItem grow>
            {COUNTS.map((c, i) => (
              <span key={c.status}>
                {i > 0 && <span className="px-1.5 text-[var(--ink-faint)]">/</span>}
                <span data-figures>{c.n}</span> {readiness[c.status]}
              </span>
            ))}
          </BandItem>
        </Band>

        <div className="px-4 pb-3 pt-7 sm:px-7">
          <Heading>{servicePanel.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{servicePanel.lede}</p>

          <div className="mt-7 flex flex-wrap gap-1.5" role="group" aria-label={servicePanel.heading}>
            {[{ key: 'all', label: servicePanel.all }, ...groupOrder.map((g) => ({ key: g, label: groups[g] }))].map(
              (g) => {
                const active = g.key === group;
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGroup(g.key)}
                    className={cx(
                      't-label border px-2.5 py-1.5 transition-colors',
                      active
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--chart)]'
                        : 'border-[color-mix(in_srgb,var(--rule)_34%,transparent)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]',
                    )}
                    style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                  >
                    {g.label}
                  </button>
                );
              },
            )}
          </div>

          <p className="mt-5 text-sm text-[var(--ink-faint)]">{servicePanel.hint}</p>
        </div>
        <div className="w-full overflow-x-auto">

          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{servicePanel.heading}</caption>
            <thead>
              <tr className="t-label rule-head text-[var(--ink-soft)]">
                <th scope="col" className="w-12 py-2 pl-4 pr-2 font-semibold sm:pl-7">
                  <span className="sr-only">{servicePanel.rows}</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">{servicePanel.colBusiness}</th>
                <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">
                  {servicePanel.colGroup}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold sm:pr-7">
                  {servicePanel.colStatus}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = open === row.code;
                const detailId = `${baseId}-${row.code}`;
                const words = services[row.code as keyof typeof services];
                return [
                  <tr
                    key={row.code}
                    className={cx(
                      'rule-row cursor-pointer align-middle transition-colors',
                      isOpen
                        ? 'bg-[color-mix(in_srgb,var(--stamp)_7%,transparent)]'
                        : 'hover:bg-[color-mix(in_srgb,var(--rule)_7%,transparent)]',
                    )}
                    style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                    onClick={() => setOpen(isOpen ? null : row.code)}
                  >
                    <td className="t-row py-2.5 pl-4 pr-2 text-[var(--ink-faint)] sm:pl-7" data-figures>
                      {row.code}
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        className="flex items-center gap-2 text-left text-[0.9375rem] font-medium text-[var(--ink)]"
                      >
                        <Caret open={isOpen} className="text-[var(--ink-faint)]" />
                        {words.name}
                      </button>
                    </td>
                    <td className="hidden py-2.5 pr-3 text-sm text-[var(--ink-soft)] sm:table-cell">
                      {groups[row.group]}
                    </td>
                    <td className="py-2.5 pr-4 text-right sm:pr-7">
                      <span className={cx('cell cell-wide', STATUS_CELL[row.status])}>
                        {readiness[row.status]}
                      </span>
                    </td>
                  </tr>,

                  isOpen && (
                    <tr key={`${row.code}-d`} id={detailId} className="rule-row">
                      <td />
                      <td colSpan={3} className="pb-6 pr-4 pt-1 sm:pr-7">
                        <p className="t-prose text-[0.9375rem] text-[var(--ink)]">{words.detail}</p>
                        <p className="t-prose mt-3 text-sm text-[var(--ink-soft)]">
                          <span className="t-label mr-2 text-[var(--ink-faint)]">
                            {readiness[row.status]}
                          </span>
                          {readinessMeaning[row.status]}
                        </p>
                        {row.type && (
                          <p className="t-label mt-3 text-[var(--ink-faint)]">
                            {servicePanel.platformType} {row.type}
                          </p>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        <div className="rule-total flex flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-7">
          <p className="t-prose text-sm text-[var(--ink-soft)]">{servicePanel.footer}</p>
          <Stamp>{servicePanel.stamp}</Stamp>
        </div>
      </Panel>
    </section>
  );
}
