/**
 * Who stands behind it.
 *
 * The place a software company normally puts a wall of customer logos and
 * three quotes. This one has one customer, and a doctor may not publish a
 * patient's praise, so there is nothing of that kind to show and nothing
 * is shown. What it has instead is unusual and checkable: a clinic that
 * runs on it and can be asked about, the person who builds it and picks up
 * the phone, and a short list of things a buyer can verify.
 *
 * Set as three ruled columns on the chart, the same way the chart sets any
 * other record. The Live stamp is pressed on the clinic and nowhere else
 * in this section.
 */
import { useContent, useContentCtx } from '@/content/use-content';
import { pathFor } from '@/content/index';
import { contact } from '@/content/contact';
import { homeCopy } from '@/content/home';
import { Band, BandItem, Heading, Panel, Ruling, Stamp } from '@/components/primitives';

export function Standing() {
  const { readiness } = useContent();
  const { locale } = useContentCtx();
  const { standing } = homeCopy[locale];
  const whatsapp = contact.whatsapp ? `https://wa.me/${contact.whatsapp}` : null;
  const tel = contact.phone ? `tel:${contact.phone.replace(/\s+/g, '')}` : null;

  const line = 'rule-row py-2.5 text-[0.9375rem] text-[var(--ink-soft)]';
  const column = 'px-4 py-7 sm:px-7';
  const label = 'text-sm text-[var(--ink-faint)]';
  const name = 't-board mt-2 text-[clamp(1.7rem,3.4vw,2.2rem)] leading-none text-[var(--ink)]';

  return (
    <section id="standing" className="frame void">
      <Panel>
        <Band>
          <BandItem>{standing.bandTitle}</BandItem>
          <BandItem grow>{standing.band}</BandItem>
        </Band>

        <div className="px-4 pb-6 pt-7 sm:px-7">
          <Heading>{standing.heading}</Heading>
          <p className="t-prose mt-4 max-w-[62ch] text-pretty text-[var(--ink-soft)]">{standing.lede}</p>
        </div>
        <Ruling />

        <div className="grid lg:grid-cols-3">
          <article className={column}>
            <div className="flex min-h-[1.75rem] flex-wrap items-center justify-between gap-3">
              <p className={label}>{standing.clinic.label}</p>
              <Stamp tone="confirmed" pressed>{readiness.LIVE}</Stamp>
            </div>
            <h3 className={name}>{standing.clinic.name}</h3>
            <p className="mt-1.5 text-sm font-semibold text-[var(--ink)]">{standing.clinic.place}</p>
            <ul className="mt-4">
              {standing.clinic.lines.map((l) => (
                <li key={l} className={line}>{l}</li>
              ))}
            </ul>
            <p className="t-prose mt-4 text-sm text-[var(--ink-soft)]">{standing.clinic.ask}</p>
          </article>

          <article className={column + ' border-t border-[color-mix(in_srgb,var(--rule)_20%,transparent)] lg:border-l lg:border-t-0'}>
            <p className={label + ' flex min-h-[1.75rem] items-center'}>{standing.founder.label}</p>
            <h3 className={name}>{standing.founder.name}</h3>
            <ul className="mt-4">
              {standing.founder.lines.map((l) => (
                <li key={l} className={line}>{l}</li>
              ))}
            </ul>
            {(tel || whatsapp) && (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">
                {standing.founder.call}{' '}
                <a href={whatsapp ?? tel ?? undefined} className="t-row font-semibold text-[var(--ink)] underline decoration-[var(--rule)] underline-offset-4" data-figures>
                  {contact.phone}
                </a>
              </p>
            )}
            <div className="mt-5">
              <a href={pathFor(locale, 'founder')} className="engraved text-[var(--ink)]">
                {standing.founder.more}
              </a>
            </div>
          </article>

          <article className={column + ' border-t border-[color-mix(in_srgb,var(--rule)_20%,transparent)] lg:border-l lg:border-t-0'}>
            <p className={label + ' flex min-h-[1.75rem] items-center'}>{standing.checks.label}</p>
            <ul className="mt-3">
              {standing.checks.lines.map((l) => (
                <li key={l} className={line}>{l}</li>
              ))}
            </ul>
            <div className="mt-5">
              <a href={pathFor(locale, 'security')} className="engraved text-[var(--ink)]">
                {standing.checks.more}
              </a>
            </div>
          </article>
        </div>
      </Panel>
    </section>
  );
}
