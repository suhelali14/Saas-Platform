/**
 * Client entry. The markup already exists -- every route is prerendered -- so
 * this hydrates rather than renders, and falls back to a fresh render if the
 * container is somehow empty (a stale deploy, a cache that served the raw
 * template). A blank page is a worse failure than a slower first paint.
 */
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
// Devanagari for the Hindi and Marathi pages. Each file carries a
// unicode-range, so an English visitor never downloads them.
import '@fontsource/khand/500.css';
import '@fontsource/khand/600.css';
import '@fontsource/ibm-plex-sans-devanagari/400.css';
import '@fontsource/ibm-plex-sans-devanagari/600.css';
import './index.css';
import { App } from './App';
import { resolveRoute } from './content/index';

const container = document.getElementById('root');
if (container) {
  const { locale, page } = resolveRoute(window.location.pathname);
  const tree = (
    <StrictMode>
      <App locale={locale} page={page} />
    </StrictMode>
  );
  if (container.hasChildNodes()) hydrateRoot(container, tree);
  else createRoot(container).render(tree);
}
