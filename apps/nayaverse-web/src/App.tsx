/**
 * The site in three languages, switched on the path.
 *
 * No client router on purpose. Every route is prerendered to real HTML and a
 * link between them is a normal navigation, which for a six-page site is
 * faster than shipping a router and strictly better for a crawler. The only
 * JavaScript that matters here is the charts, the fare selector and the form.
 */
import { useEffect } from 'react';
import { MotionProvider, Reveal } from '@/components/Reveal';
import { startSettling } from '@/components/settle';
import { ContentProvider } from '@/content/use-content';
import { content, pathFor, isGuidePage, type Locale, type Page } from '@/content/index';
import { SimplePage, pageToSimpleKey } from '@/sections/SimplePage';
import { GuideArticle, GuidesIndex } from '@/sections/Guides';
import { Enquiry, Footer, Header, PhoneBar, Questions, Zoomer } from '@/v2/parts';
import { ClinicPage, GrowthPage, HomePage, PricingPage, VisionPage } from '@/v2/pages';

function Body({ locale, page }: { locale: Locale; page: Page }) {
  const t = content[locale];
  useEffect(() => startSettling(), []);

  return (
    <MotionProvider>
      <div className="v2 flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--v-accent)] focus:px-3 focus:py-2 focus:text-white"
        >
          {t.nav.skip}
        </a>
        <Header />
        <main id="main" className="flex-1">
          {/* The approved design (26 November 2026): the company first, then
              its two products, then what comes after. The build still counts
              the Vision page's status cells and refuses a Live on Growth
              (scripts/prerender.mjs). */}
          {page === 'home' && <HomePage />}
          {page === 'clinic' && <ClinicPage />}
          {page === 'growth' && <GrowthPage />}
          {page === 'vision' && <VisionPage />}
          {page === 'pricing' && <PricingPage />}

          {pageToSimpleKey(page) && (
            <>
              <div className="py-10">
                <Reveal defer>
                  <SimplePage locale={locale} page={page} />
                </Reveal>
              </div>
              <Questions />
              <Enquiry />
            </>
          )}

          {page === 'guides' && (
            <>
              <div className="py-10">
                <Reveal defer>
                  <GuidesIndex />
                </Reveal>
              </div>
              <Questions />
              <Enquiry />
            </>
          )}

          {isGuidePage(page) && (
            <>
              <div className="py-10">
                <Reveal defer>
                  <GuideArticle page={page} />
                </Reveal>
              </div>
              <Enquiry />
            </>
          )}

          {page === '404' && (
            <section className="v-sec">
              <div className="v-wrap">
                <h1 className="v-h1">{t.notFound.heading}</h1>
                <p className="v-lead">{t.notFound.lede}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href={pathFor(locale, 'home')} className="v-btn">
                    {t.notFound.chart}
                  </a>
                  <a href={pathFor(locale, 'pricing')} className="v-btn-ghost">
                    {t.notFound.fares}
                  </a>
                </div>
              </div>
            </section>
          )}
        </main>
        <Footer />
        <PhoneBar />
        <Zoomer />
      </div>
    </MotionProvider>
  );
}

export function App({ locale, page }: { locale: Locale; page: Page }) {
  return (
    <ContentProvider locale={locale} page={page}>
      <Body locale={locale} page={page} />
    </ContentProvider>
  );
}
