/** @type {import('tailwindcss').Config} */
export default {
  // Two themes, and LIGHT is the one that ships: reception works in
  // daylight at a front desk, so that is the default ThemeContext applies.
  // Dark is offered for a doctor's evening clinic.
  //
  // The tokens are still arranged dark-on-:root with light overriding under
  // `.theme-light`, because the portal was written dark-first; flipping the
  // cascade would mean no screen rendered correctly until all forty
  // components had been converted. `selector` rather than `class` is what
  // lets `dark:` variants keep working against that inverted arrangement.
  darkMode: ["selector", ':root:not(.theme-light)'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Clinical state, named for the meaning rather than the hue. A
        // triage tier or an expiry warning must not change colour because
        // someone restyled the app -- these carry information, and two of
        // them are read by someone deciding what to dispense.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        // Something to read rather than act on: a note, a reference
        // range, a role. Separate from `primary`, which means "this is
        // the action" -- reusing the action colour for information is how
        // a screen ends up with six equally loud blue things on it.
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // INK, as opposed to the grounds above: the colour a piece of
        // text takes when it carries this meaning. Separate because one
        // value cannot be both a fill that white sits on and a legible
        // text colour on the page -- see index.css for the measurements.
        // `text-ink-danger`, `border-ink-warning/30`, and so on.
        // Chart marks. Separate from `ink` because a filled mark and a
        // run of text want different lightness on a dark ground -- see
        // index.css for the measurements and the validator command.
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          grid: "hsl(var(--chart-grid))",
        },
        ink: {
          success: "hsl(var(--ink-success))",
          warning: "hsl(var(--ink-warning))",
          danger: "hsl(var(--ink-danger))",
          info: "hsl(var(--ink-info))",
          violet: "hsl(var(--ink-violet))",
          pink: "hsl(var(--ink-pink))",
          teal: "hsl(var(--ink-teal))",
        },
      },
      // Elevation, as three steps rather than per-component arbitrary
      // values. Each has a real y-offset and a soft blur, and each is two
      // layers -- a tight contact shadow plus a wide ambient one -- which
      // is what separates a card that looks lifted from one wearing a
      // grey halo. They resolve through --shadow, so the dark theme casts
      // a near-black shadow and the light theme a blue-tinted one.
      boxShadow: {
        card: "0 1px 2px -1px hsl(var(--shadow) / 0.08), 0 2px 10px -3px hsl(var(--shadow) / 0.10)",
        raised: "0 2px 4px -2px hsl(var(--shadow) / 0.10), 0 8px 22px -6px hsl(var(--shadow) / 0.16)",
        overlay: "0 6px 14px -5px hsl(var(--shadow) / 0.16), 0 22px 52px -12px hsl(var(--shadow) / 0.26)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // "Inter Variable" is the family name @fontsource-variable/inter
        // registers -- not "Inter". Naming it "Inter" here, as this config
        // did, silently fell through to the next entry, which is why the
        // whole portal rendered in the OS default. It is imported in
        // main.tsx; plain "Inter" stays in the list for anyone who has it
        // installed locally.
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // A moving highlight, not a pulse. A pulse reads as "disabled";
        // a sweep reads as "filling in".
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
