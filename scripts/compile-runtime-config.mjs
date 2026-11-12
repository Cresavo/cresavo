// Build-only: preserve the exact Next configuration without a runtime compiler.
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const result = ts.transpileModule(readFileSync("next.config.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  reportDiagnostics: true,
});
if (result.diagnostics?.some((d) => d.category === ts.DiagnosticCategory.Error))
  throw new Error("PREVIEW_CONFIG_COMPILE_FAILED");
writeFileSync("next.config.mjs", result.outputText);
