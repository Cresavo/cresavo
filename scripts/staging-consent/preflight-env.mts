// The runner's first import. ES modules are evaluated in import order, so these checks run before
// any later import is evaluated: Playwright opens DEBUG_FILE and Prisma reads DEBUG as soon as they
// load. A refused run therefore stops before either has touched anything.
import { refuseDiagnostics, refuseInsecureTls, refuseRemoteBrowsers } from "./preflight.mjs";

refuseDiagnostics(process.env, process.execArgv);
refuseRemoteBrowsers(process.env);
refuseInsecureTls(process.env);
