import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Portal theme (dark default, light optional).
 *
 * Applied as a class on <html> rather than through React state on a
 * wrapper element, because the styling in theme.css has to reach every
 * component -- including ones rendered into portals or outside the app
 * root -- without any of them knowing the theme exists.
 *
 * The public clinic website deliberately does NOT use this: it is always
 * light, because it is read once by a patient deciding whether to visit,
 * not stared at for eight hours by staff.
 */

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'clinicTheme';

interface ThemeValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue>({ theme: 'dark', toggleTheme: () => {} });

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // No stored choice: follow the operating system. A clinic running its
    // machines in dark mode gets the dark portal without asking for it.
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // Private browsing or blocked site data -- fall through to the default.
  }
  // Light is the default now, not dark.
  //
  // The portal was built dark because it is a tool used for hours. But a
  // front desk works in daylight, the clinic's own public site is light,
  // and a doctor moving between the two met two different products. The
  // chosen direction is the light one, so that is what someone sees
  // before they have expressed any preference.
  //
  // Dark is not gone -- it is one click away in the header, it is still
  // the OS-preference answer above, and a stored choice always wins.
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    // Tells the browser which scrollbar and form-control styling to use.
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persisting is a convenience; the theme still applies this session.
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
