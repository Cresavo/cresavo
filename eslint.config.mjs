import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { designSystem } from "./scripts/eslint-design-system.mjs";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.tsx"],
    plugins: { "design-system": designSystem },
    rules: {
      "design-system/no-hex": "warn",
      "design-system/token-sizes": "warn",
      "design-system/shared-controls": "warn",
    },
  },
  {
    files: ["src/concept/ui/**", "src/app/(development)/studio/%5Fgallery/**"],
    rules: { "design-system/shared-controls": "off" },
  },
  // Operator-only profiles and generated diagnostics are never product source.
  { ignores: [".next/**", ".vercel/**", "node_modules/**", "test-results/**", "next-env.d.ts", ".claude/**"] },
];
export default config;
