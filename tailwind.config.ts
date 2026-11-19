import type { Config } from "tailwindcss";

// Semantic colours, radii and the UI font come from the brand tokens in
// src/concept/ui/brand-theme.css (tenant pages re-declare them in
// tenant-theme.css). color-mix keeps opacity modifiers such as `bg-surface/80`.
const ui = (name: string) => `color-mix(in srgb, var(--ui-${name}) calc(<alpha-value> * 100%), transparent)`;
const names = [
  "bg", "surface", "surface-2", "text", "text-secondary", "border", "hairline", "input-border",
  "action", "action-hover", "action-bg", "focus",
  "success", "success-bg", "warning", "warning-bg", "danger", "danger-bg", "info", "info-bg",
  "staff-1", "staff-1-bg", "staff-2", "staff-2-bg", "chart-compare",
];

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      xs: "var(--radius-xs)",
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      full: "var(--radius-pill)",
    },
    extend: {
      colors: { ...Object.fromEntries(names.map((name) => [name, ui(name)])), "on-action": ui("action-text") },
      fontFamily: { sans: ["var(--font-ui)"] },
      spacing: {
        ...Object.fromEntries([1, 2, 3, 4, 6, 8].map(n => [n, `var(--space-${n})`])),
        target: "var(--touch-target)",
      },
      fontSize: {
        h1: ["var(--type-h1)", "1.2"], h2: ["var(--type-h2)", "1.3"],
        h3: ["var(--type-h3)", "1.4"], body: ["var(--type-body)", "1.5"],
        meta: ["var(--type-meta)", "1.5"], minimum: ["var(--type-min)", "1.5"],
      },
      zIndex: { sticky: "var(--z-sticky)", popover: "var(--z-popover)", toast: "var(--z-toast)" },
      transitionDuration: { quick: "var(--dur-1)", normal: "var(--dur-2)", slow: "var(--dur-3)" },
      transitionTimingFunction: { enter: "var(--ease-out)", exit: "var(--ease-in)" },
      boxShadow: {
        raised: "var(--elevation-raised)", sheet: "var(--elevation-sheet)",
      },
    },
  },
  plugins: [],
} satisfies Config;
