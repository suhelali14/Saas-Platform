/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // One theme, not two. Reading happens on the cream chart panels; the
    // steel is the frame around them, not a reading surface. There is
    // nothing for a dark mode to invert.
    extend: {
      colors: {
        steel: 'var(--steel)',
        'steel-deep': 'var(--steel-deep)',
        'steel-line': 'var(--steel-line)',
        board: 'var(--board)',
        chart: 'var(--chart)',
        'chart-band': 'var(--chart-band)',
        rule: 'var(--rule)',
        'rule-soft': 'var(--rule-soft)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        'board-ink': 'var(--board-ink)',
        'board-ink-soft': 'var(--board-ink-soft)',
        confirmed: 'var(--confirmed)',
        waiting: 'var(--waiting)',
        priority: 'var(--priority)',
        stamp: 'var(--stamp)',
        lamp: 'var(--lamp)',
      },
      fontFamily: {
        // The Devanagari face sits after the Latin one in each stack: a
        // browser resolves the family per glyph, so Latin still comes from
        // Barlow and Plex while Devanagari comes from Khand and Plex
        // Devanagari, with no language switch needed in the CSS.
        board: ['"Barlow Condensed"', 'Khand', 'Haettenschweiler', 'sans-serif'],
        sans: [
          '"IBM Plex Sans Variable"',
          '"IBM Plex Sans"',
          '"IBM Plex Sans Devanagari"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans Devanagari"', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        frame: '78rem',
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
