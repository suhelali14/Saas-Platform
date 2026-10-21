/**
 * The enquiry counter.
 *
 * There is no lead backend, and building one to hold six fields would be the
 * wrong thing: this market replies on WhatsApp. So the form composes the
 * message and hands it over, with an email fallback. Nothing is posted
 * anywhere and nothing is stored, which is also the honest answer to "what
 * happens to what I type here".
 *
 * When the contact values are still blank the form says so and the button is
 * disabled, rather than handing a visitor an action that goes nowhere.
 */
import { useState } from 'react';
import { useContent } from '@/content/use-content';
import { contact, contactReady } from '@/content/contact';
import { serviceRows } from '@/content/structure';
import { Band, BandItem, Heading, Panel } from '@/components/primitives';

const LOGIN_BANDS = ['1-2', '3-10', '11-40', '40+'] as const;

export function Enquiry() {
  const { enquiry, services } = useContent();
  const [business, setBusiness] = useState('');
  const [kind, setKind] = useState('');
  const [city, setCity] = useState('');
  const [logins, setLogins] = useState<string>(LOGIN_BANDS[0]);
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');

  const message = [
    enquiry.messageTitle,
    '',
    `${enquiry.mBusiness}: ${business || '-'}`,
    `${enquiry.mKind}: ${kind || '-'}`,
    `${enquiry.mCity}: ${city || '-'}`,
    `${enquiry.mLogins}: ${logins}`,
    `${enquiry.mFrom}: ${person || '-'}${phone ? ` - ${phone}` : ''}`,
  ].join('\n');

  const waHref = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`
    : null;

  const mailHref = contact.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(
        `${enquiry.messageTitle} - ${business || ''}`,
      )}&body=${encodeURIComponent(message)}`
    : null;

  const primary = waHref ?? mailHref;
  const primaryLabel = waHref ? enquiry.submit : enquiry.submitFallback;

  return (
    <section id="enquiry" className="frame void">
      <Panel>
        <Band>
          <BandItem>{enquiry.bandTitle}</BandItem>
          <BandItem grow>{enquiry.band}</BandItem>
        </Band>

        <div className="grid gap-x-12 gap-y-8 px-4 py-7 sm:px-7 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div>
            <Heading>{enquiry.heading}</Heading>
            <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{enquiry.lede}</p>

            {(contact.phone || contact.email) && (
              <dl className="mt-6 space-y-2 text-[0.9375rem]">
                {contact.phone && (
                  <div className="flex gap-3">
                    <dt className="t-label pt-1 text-[var(--ink-faint)]">{enquiry.labelPhone}</dt>
                    <dd>
                      <a
                        href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                        className="text-[var(--ink)] underline decoration-[color-mix(in_srgb,var(--rule)_55%,transparent)] hover:decoration-[var(--ink)]"
                        data-figures
                      >
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.email && (
                  <div className="flex gap-3">
                    <dt className="t-label pt-1 text-[var(--ink-faint)]">{enquiry.labelEmail}</dt>
                    <dd>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-[var(--ink)] underline decoration-[color-mix(in_srgb,var(--rule)_55%,transparent)] hover:decoration-[var(--ink)]"
                      >
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          <form className="grid gap-x-5 gap-y-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <label className="block sm:col-span-2">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.businessName}</span>
              <input
                className="field mt-1.5"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder={enquiry.businessNamePlaceholder}
                autoComplete="organization"
              />
            </label>

            <label className="block">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.whatKind}</span>
              <select className="field mt-1.5" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{enquiry.chooseRow}</option>
                {serviceRows.map((s) => {
                  const name = services[s.code as keyof typeof services].name;
                  return (
                    <option key={s.code} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.city}</span>
              <input
                className="field mt-1.5"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={contact.city}
                autoComplete="address-level2"
              />
            </label>

            <label className="block">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.loginsNeeded}</span>
              <select className="field mt-1.5" value={logins} onChange={(e) => setLogins(e.target.value)}>
                {LOGIN_BANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.yourName}</span>
              <input
                className="field mt-1.5"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                autoComplete="name"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="t-label text-[var(--ink-faint)]">{enquiry.phone}</span>
              <input
                className="field mt-1.5"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder={enquiry.phonePlaceholder}
              />
            </label>

            <div className="sm:col-span-2">
              {contactReady && primary ? (
                <a
                  href={primary}
                  target={waHref ? '_blank' : undefined}
                  rel={waHref ? 'noreferrer' : undefined}
                  className="plate w-full sm:w-auto"
                >
                  {primaryLabel}
                </a>
              ) : (
                <>
                  <button type="button" className="plate w-full sm:w-auto" disabled>
                    {enquiry.submit}
                  </button>
                  <p className="t-prose mt-3 text-sm text-[var(--waiting)]">{enquiry.unavailable}</p>
                </>
              )}
            </div>
          </form>
        </div>
      </Panel>
    </section>
  );
}
