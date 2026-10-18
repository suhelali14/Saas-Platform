import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TenantGate } from './TenantGate';
/*
 * Inter, self-hosted.
 *
 * tailwind.config.js has named Inter as this app's `font-sans` since the
 * portal was built, but nothing ever loaded it -- so every screen has
 * been rendering in whatever the OS supplies (Segoe UI on Windows, San
 * Francisco on a Mac), and the `cv11`/`ss01` feature settings in
 * index.css were asking a font that was not there for features it does
 * not have. The type was the platform default pretending to be a
 * decision.
 *
 * Self-hosted rather than linked from Google Fonts, for the same reason
 * index.css stopped using the Tailwind CDN: a clinic's front desk should
 * not depend on reaching a third party to look right. This is the
 * weight-axis variable file, so one 48KB request covers every weight
 * from 100 to 900, and `unicode-range` means the browser fetches only
 * the latin subset it actually needs.
 */
import '@fontsource-variable/inter/wght.css';
// Tailwind itself, plus the design tokens. Built locally now rather than
// compiled in the browser by a CDN script -- see index.css.
import './index.css';
// Loaded after Tailwind, so its overrides win at equal specificity. See
// theme.css for why it is written as a remap rather than as dark:
// variants on forty components.
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantGate>
      <App />
    </TenantGate>
  </StrictMode>,
);
