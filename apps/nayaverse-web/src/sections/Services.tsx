/**
 * Counter services: work a person does, not something the software does.
 *
 * Kept visibly apart from the manifest for one reason. Everything else on this
 * site is a capability of the product; this is labour. Letting the two share a
 * section is how a buyer ends up expecting an automated campaign tool and
 * getting a human with a calendar.
 *
 * Which is why the availability table is not a feature matrix with ticks: it
 * says, per class, in words, how much of somebody's time is in the price.
 */
import { useContent } from '@/content/use-content';
import { Band, BandItem, Heading, Panel, Ruling } from '@/components/primitives';

export function Services() {
  const { servicesOffer } = useContent();
  return (
    <section id="services-offer" className="frame void">
      <Panel>
        <Band>
          <BandItem>{servicesOffer.bandTitle}</BandItem>
          <BandItem grow>{servicesOffer.band}</BandItem>
        </Band>

        <div className="px-4 pb-4 pt-7 sm:px-7">
          <Heading>{servicesOffer.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{servicesOffer.lede}</p>
        </div>

        <div className="px-4 pb-6 sm:px-7">
          <Ruling />
          <dl>
            {servicesOffer.included.map((s) => (
              <div
                key={s.name}
                className="rule-row grid gap-x-8 gap-y-1 py-3.5 sm:grid-cols-[14rem_minmax(0,1fr)]"
              >
                <dt className="text-[0.9375rem] font-semibold text-[var(--ink)]">{s.name}</dt>
                <dd className="t-prose text-[0.9375rem] text-[var(--ink-soft)]">{s.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-[var(--chart-band)] px-4 py-5 sm:px-7">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {servicesOffer.availability.map((a) => (
              <div key={a.klass}>
                <dt className="t-board text-[1.0625rem] leading-none text-[var(--ink)]">{a.klass}</dt>
                <dd className="mt-1.5 text-sm text-[var(--ink-soft)]">{a.what}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rule-total px-4 py-5 sm:px-7">
          <p className="t-prose text-sm text-[var(--ink-soft)]">{servicesOffer.honesty}</p>
        </div>
      </Panel>
    </section>
  );
}
