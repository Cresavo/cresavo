import pkg from "../../package.json" with { type: "json" };

/** The released version, from package.json. One place, so every runtime (Next, Node ESM, Playwright) loads it the same way. */
export const APP_VERSION: string = pkg.version;
