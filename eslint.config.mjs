import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { designSystem } from "./scripts/eslint-design-system.mjs";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/concept/actions.ts", "src/concept/data/slots.ts", "src/concept/store/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='Date'][property.name='now'], MemberExpression[object.name='Date'][property.value='now']",
          message: "Use the injected store clock. Explain any legacy wall-clock fallback with a narrow disable comment.",
        },
      ],
    },
  },
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
