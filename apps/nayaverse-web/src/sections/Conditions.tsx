/**
 * Conditions of carriage: the fine print, where the awkward answers live.
 *
 * Native <details>, for three reasons that all matter here: it works with the
 * script turned off, it is already right for a screen reader, and every answer
 * stays in the document rather than behind a click -- so the answers a buyer
 * searches for are findable, which is half of why this page exists.
 */
import { useContent } from '@/content/use-content';
import { Band, BandItem, Caret, Heading, Panel } from '@/components/primitives';

export function Conditions() {
  const { conditionsPanel, conditions } = useContent();
  return (
    <section id="conditions" className="frame void">
      <Panel>
        <Band>
          <BandItem>{conditionsPanel.bandTitle}</BandItem>
          <BandItem grow>
            <span data-figures>{conditions.length}</span> {conditionsPanel.clauses}
          </BandItem>
        </Band>

        <div className="px-4 pb-3 pt-7 sm:px-7">
          <Heading>{conditionsPanel.heading}</Heading>
          <p className="t-prose mt-4 text-[var(--ink-soft)]">{conditionsPanel.lede}</p>
        </div>

        <div className="px-4 pb-7 sm:px-7">
          {conditions.map((c) => (
            <details key={c.q} className="rule-row group">
              <summary className="flex items-start gap-3 py-3.5 text-[1.0625rem] font-medium text-[var(--ink)]">
                <Caret open={false} className="caret-auto mt-[0.4rem] shrink-0 text-[var(--ink-faint)]" />
                <span className="text-pretty">{c.q}</span>
              </summary>
              <p className="t-prose pb-5 pl-[1.65rem] text-[0.9375rem] text-[var(--ink-soft)]">{c.a}</p>
            </details>
          ))}
        </div>
      </Panel>
    </section>
  );
}
