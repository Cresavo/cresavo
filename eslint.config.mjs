import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
const config = [
  ...nextVitals,
  ...nextTypescript,
  // Operator-only profiles and generated diagnostics are never product source.
  { ignores: [".next/**", ".vercel/**", "node_modules/**", "test-results/**", "next-env.d.ts"] },
];
export default config;
