/**
 * The current locale's words, and the current page, available anywhere.
 *
 * A context rather than props because almost every component needs the text
 * and almost none of them need anything else about the route; threading a
 * content object through nine section components would be noise.
 *
 * There is no default. A component rendered outside the provider is a bug in
 * the tree, not a case to paper over with English — and finding it at build
 * time, when the prerender runs, is the cheapest place to find it.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { content, type Content, type Locale, type Page } from './index';

type Ctx = { t: Content; locale: Locale; page: Page };

const ContentContext = createContext<Ctx | null>(null);

export function ContentProvider({
  locale,
  page,
  children,
}: {
  locale: Locale;
  page: Page;
  children: ReactNode;
}) {
  return (
    <ContentContext.Provider value={{ t: content[locale], locale, page }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContentCtx(): Ctx {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent used outside ContentProvider');
  return ctx;
}

/** The words. */
export function useContent(): Content {
  return useContentCtx().t;
}
