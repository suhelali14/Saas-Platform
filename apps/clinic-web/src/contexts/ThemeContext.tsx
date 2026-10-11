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
    // No stored choice: follow the operating system, so a clinic that runs
    // its machines in light mode isn't handed a dark screen by default.
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    // Private browsing or blocked site data -- fall through to the default.
  }
  return 'dark';
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
