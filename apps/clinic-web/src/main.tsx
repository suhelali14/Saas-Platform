import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Loaded after the Tailwind CDN script in index.html, so these overrides
// win at equal specificity. See theme.css for why it's written this way.
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
