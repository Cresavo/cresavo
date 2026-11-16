import type { Config } from "tailwindcss";

// `eko` colours are CSS variables set in src/app/studio/studio.css (light and dark).
const eko = (name: string) => `rgb(var(--eko-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        eko: {
          bg: eko("bg"),
          surface: eko("surface"),
          sunken: eko("sunken"),
          line: eko("line"),
          ink: eko("ink"),
          muted: eko("muted"),
          accent: eko("accent"),
          "accent-soft": eko("accent-soft"),
          "on-accent": eko("on-accent"),
          warn: eko("warn"),
          "warn-soft": eko("warn-soft"),
          danger: eko("danger"),
          "danger-soft": eko("danger-soft"),
          anna: eko("anna"),
          "anna-soft": eko("anna-soft"),
          erik: eko("erik"),
          "erik-soft": eko("erik-soft"),
        },
      },
      boxShadow: {
        card: "0 1px 2px rgb(40 30 20 / 0.04), 0 4px 16px rgb(40 30 20 / 0.04)",
        sheet: "0 -8px 40px rgb(20 15 10 / 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
