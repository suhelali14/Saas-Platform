import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TenantGate } from './TenantGate';
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
