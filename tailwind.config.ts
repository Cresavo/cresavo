import type { Config } from "tailwindcss";

// Semantic colours, radii and the UI font come from the Libovo tokens in
// src/concept/ui/libovo-theme.css (tenant pages re-declare them in
// tenant-theme.css). color-mix keeps opacity modifiers such as `bg-surface/80`.
const ui = (name: string) => `color-mix(in srgb, var(--ui-${name}) calc(<alpha-value> * 100%), transparent)`;
const names = [
  "bg", "surface", "surface-2", "text", "text-secondary", "border", "input-border",
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
      boxShadow: {
        sheet: "0 -8px 40px rgb(0 0 0 / 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
