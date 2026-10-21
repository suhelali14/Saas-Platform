/**
 * Two pages in three languages, switched on the path.
 *
 * No client router on purpose. Every route is prerendered to real HTML and a
 * link between them is a normal navigation, which for a six-page site is
 * faster than shipping a router and strictly better for a crawler. The only
 * JavaScript that matters here is the charts, the fare selector and the form.
 */
import { useCallback } from 'react';
import { ContentProvider } from '@/content/use-content';
import { content, pathFor, type Locale, type Page } from '@/content/index';
import { Rail } from '@/sections/Rail';
import { Hero } from '@/sections/Hero';
import { ServiceChart } from '@/sections/ServiceChart';
import { DayCharts } from '@/sections/DayCharts';
import { Manifest } from '@/sections/Manifest';
import { Growth } from '@/sections/Growth';
import { Services } from '@/sections/Services';
import { Fares } from '@/sections/Fares';
import { About } from '@/sections/About';
import { Conditions } from '@/sections/Conditions';
import { Enquiry } from '@/sections/Enquiry';
import { Footer } from '@/sections/Footer';
import { Board, Heading } from '@/components/primitives';

function useEnquire() {
  return useCallback(() => {
    const target = document.getElementById('enquiry');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Land the caret in the first field rather than leaving someone to find it.
    window.setTimeout(() => {
      target.querySelector<HTMLInputElement>('input, select')?.focus({ preventScroll: true });
    }, 520);
  }, []);
}

function Body({ locale, page }: { locale: Locale; page: Page }) {
  const onEnquire = useEnquire();
  const t = content[locale];

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--lamp)] focus:px-3 focus:py-2 focus:text-[var(--ink)]"
      >
        {t.nav.skip}
      </a>

      <Rail onEnquire={onEnquire} />

      <main id="main" className="flex-1">
        {page === 'home' && (
          <>
            {/* The reading path: what is this and what does it cost, is my
                business on the chart, what does it look like for my trade,
                what is in it, why it is worth money, what else comes with it,
                the price, who you are dealing with, the awkward questions,
                then the counter. */}
            <Hero onEnquire={onEnquire} />
            <ServiceChart />
            <DayCharts />
            <Manifest />
            <Growth />
            <Services />
            <Fares onEnquire={onEnquire} />
            <About />
            <Conditions />
            <Enquiry />
          </>
        )}

        {page === 'pricing' && (
          <>
            <section className="frame frame-wide pb-10 pt-8 sm:pt-12">
              <Board className="px-5 py-8 sm:px-10 sm:py-11">
                <h1 className="t-board text-[clamp(2.6rem,8vw,5rem)] text-[var(--board-ink)]">
                  {t.farePanel.pageHeading}
                </h1>
                <p className="t-lede mt-5 text-pretty text-[var(--board-ink-soft)]">
                  {t.farePanel.pageLede}
                </p>
              </Board>
            </section>
            <Fares onEnquire={onEnquire} />
            <Services />
            <About />
            <Conditions />
            <Enquiry />
          </>
        )}

        {page === '404' && (
          <section className="frame void">
            <Board className="px-5 py-12 sm:px-10 sm:py-16">
              <Heading as="h1" className="text-[var(--board-ink)]">
                {t.notFound.heading}
              </Heading>
              <p className="t-lede mt-5 text-[var(--board-ink-soft)]">{t.notFound.lede}</p>
              <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-3">
                <li>
                  <a href={pathFor(locale, 'home')} className="engraved">
                    {t.notFound.chart}
                  </a>
                </li>
                <li>
                  <a href={pathFor(locale, 'pricing')} className="engraved">
                    {t.notFound.fares}
                  </a>
                </li>
              </ul>
            </Board>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

export function App({ locale, page }: { locale: Locale; page: Page }) {
  return (
    <ContentProvider locale={locale} page={page}>
      <Body locale={locale} page={page} />
    </ContentProvider>
  );
}
