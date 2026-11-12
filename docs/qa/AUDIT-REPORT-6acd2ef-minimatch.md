# Auditrapport – minimatch (GHSA-g3hv-75wg-m249), bas 6acd2ef (produkt d7bc47f)

Grok Bot, oberoende QA. Datum: 2026-11-12, ca 19:50 CET. Körd EN gång. Ingen UI-QA, ingen kodändring i något original, ingen deploy/push.

## Verdikt
**Auditen är INTE löst.** Det finns ingen publicerad stabil kedja som har patchen: typescript-eslint/@typescript-eslint/* `latest` = 8.72.2 kräver minimatch `^10.2.2`, och patchen finns bara i minimatch ≥ 11.0.1. Det finns ingen 10.x-backport. Faktisk risk för Booking Lab: **låg** (bara dev/lint; den sårbara kodvägen nås inte med nuvarande konfig). Rekommendation: (d) acceptera tidsbegränsat och dokumenterat, kombinerat med (a) vänta på publicerad stabil release. Riskreduktion är INTE en patch.

## Omfång och indata
- PC:n var offline. Som ställföreträdare användes package.json/package-lock.json ur den tidigare verifierade d7bc47f-zippen (`ui-d7bc47f/booking-ui-fix2.zip`).
- Zippens råbytes (CRLF): package.json `289c6e1454f0a5f24f8a5072b8eaf6c7892c18d15ffde49d036496fe57eee801`, package-lock.json `2a8733f010cd3bddbeeb3c5e69ff229a40f4df9524d8499dac204484efaa537b`.
- LF-normaliserat (scratch): package.json `d2a1d8f5c1bbad2f25d241a11ff3de63aeca07b01429e6152efab685cb9dbccd`, package-lock.json `832167508af6249f85ec9923b961af81208258309098750f6ec59365ffd64940`.
- **Hashmatch mot 6acd2ef:** Codex rapporterar för 6acd2ef lock `2a8733f0…aa537b` (byte-identisk med zippen) och package.json `d2a1d8f5…dbccd`, som är exakt lika med zippens package.json med CR borttaget. Innehållet är alltså identiskt, och bara radslut skiljer i arkivet. Codex uppger även att `git diff d7bc47f..6acd2ef -- package.json package-lock.json` är tom (UNVERIFIED, Codex-påstående).
  - Detta är en hashjämförelse mot befintliga arkivfiler. **INGA nya PC-filer lästes.** audit-before.json och fix-dry-run.json från PC:n lästes INTE.
  - Slutsatserna bygger på d7bc47f-locken; 6acd2ef täcks via hashmatchen ovan.
- Scratch: `/workspace/qa/booking-lab-se/audit-6acd2ef/` (`src/` = baslinje, `override/` = probe, `logs/` = rålogg, `tarballs/` = npm pack).

## VERIFIED
1. **Advisory** (api.github.com):
   - GHSA-g3hv-75wg-m249 / CVE-2026-118764, moderate, CVSS v4 6.9 (AV:N/AC:L/…/VA:L), CWE-405.
   - Sårbart `>= 7.0.0, < 11.0.1`, patch 11.0.1, ingen 10.x-backport.
   - Sårbar väg: `firstPhasePreProcess()` (amplifiering av `**/../`) och kvadratisk `partsMatch` i `secondPhasePreProcess`. Kräver **angriparstyrt glob-mönster OCH `optimizationLevel >= 2`** (default är 1).
2. **minimatch på registret:**
   - dist-tags: latest 11.0.8, legacy-v9…v3. **Ingen 10-tagg.**
   - Senaste 10.x är 10.2.6 (2026-07-27), som är sårbar. 11.0.0–11.0.8 publicerades 2026-10-27…11-11.
   - 11.x: engines `18 || 20 || >=22`, ESM+CJS-exports. Nytt beroende: `@isaacs/nonrecursive-glob-match`.
3. **typescript-eslint, @typescript-eslint/{typescript-estree,parser,eslint-plugin,utils,type-utils}:**
   - Alla har `latest` 8.72.2 (2026-11-09) och `canary` 8.72.3-alpha.8 (2026-11-11). Det finns ingen `next`/`rc` för 8.72.
   - minimatch-range finns bara i typescript-estree: 8.72.2 och 8.72.3-alpha.0 har `^10.2.2`; **8.72.3-alpha.1…alpha.8 har `^11.0.1`**.
   - `npm pack` bekräftar detta: 8.72.2-tarballen har `^10.2.2` och alpha.8-tarballen har `^11.0.1`. Engines är oförändrade.
4. **Publicerat vs main (hålls isär):**
   - GitHub main `packages/typescript-estree/package.json` har version 8.72.2 och minimatch `^11.0.1` (commit 837401e92d, 2026-11-10 01:18 CET).
   - Main är INTE en publicerad stabil release. Den har bara publicerats som canary. Main innehåller också ny `feat` (projectService EXPERIMENTAL_backend), så nästa stabila blir troligen 8.73.0. Datumet är okänt (tidigare releaser kom på måndagar).
5. **Lock och träd:** två minimatch-instanser, båda dev.
   - `minimatch@3.1.5` (eslint, @eslint/*, eslint-plugin-import/jsx-a11y/react). Ligger utanför det sårbara intervallet.
   - `@typescript-eslint/typescript-estree/node_modules/minimatch@10.2.6`, via eslint-config-next → typescript-eslint@8.72.2 → typescript-estree. Detta är den sårbara instansen.
6. **npm audit (scratch, `npm ci --ignore-scripts`):**
   - Full audit: 7 moderate. minimatch står som rot. typescript-estree, parser, utils, type-utils, eslint-plugin och typescript-eslint följer bara med transitivt (en och samma sårbara nod).
   - `--omit=dev`: 0. `npm ls minimatch --omit=dev`: tomt.
   - `npm audit fix --dry-run --ignore-scripts`: 0 tillagda, 0 ändrade, 0 borttagna, 7 kvar. Förklaring: den enda fixen är minimatch ≥11.0.1, vilket ligger utanför typescript-estree@8.72.2:s `^10.2.2`. Ingen publicerad stabil @typescript-eslint tillåter 11, och npm väljer inte prerelease. `fixAvailable:true` är alltså missvisande.
   - Codex-observationen (7 moderate / 0 runtime / 0 ändringar) är **bekräftad**.
7. **Anropsyta (scratch-installation):**
   - Enda runtime-anropet av minimatch i @typescript-eslint är `useProgramFromProjectService.js:244`: `minimatch(filePath, pattern, { dot: true })`, där pattern kommer från `parserOptions.projectService.allowDefaultProject`. Ingen `optimizationLevel` sätts, så default 1 gäller. Ingen förekomst av `optimizationLevel` i @typescript-eslint.
   - `eslint.config.mjs` = bara `nextVitals` + `nextTypescript` + ignores. Ingen `projectService` eller `allowDefaultProject` i repot eller i den upplösta konfigen.
   - Codex-observationen är **bekräftad**. Mönstren är dessutom utvecklarstyrda (konfig), inte angriparstyrda.
8. **CI:**
   - `verify.yml` kör `npm run lint` även för fork-PR:er (`pull_request`, read-only token). En fork-PR kan alltså ändra eslint-konfigen själv. Men den kan då redan köra godtycklig kod (konfigen är JS), så minimatch-DoS tillför ingen ny förmåga utöver att den egna CI-jobben kan hänga (timeout 20 min).
   - `dependency-audit.yml` kör veckovis `npm audit` och `--audit-level=high`. Moderate fäller inte high-steget.
9. **Override-probe (bara i `audit-6acd2ef/override/`, inte rekommendation):**
   - Avgränsad override `{"@typescript-eslint/typescript-estree": {"minimatch": "11.0.8"}}` gav 572 paket och **0 sårbarheter**. Locken ändras (13+/5−).
   - `npx eslint .`: exit 0 och identisk utdata med baslinjen.
   - `npx tsc --noEmit` efter `prisma generate` (dummy-URL, ingen DB): exit 0 i båda.
   - API-smoke: CJS `require` ger `minimatch` som funktion med korrekta träffar. `parseForESLint` med `projectService.allowDefaultProject` fungerar.
   - Utan prisma generate gav tsc 77 identiska fel i båda (genererad klient saknas). Det är inte override-relaterat.

## NOT RUN
- Ingen `next build` eller `.next/standalone`/trace-granskning (onödigt: inget minimatch i `--omit=dev`-trädet, och next har ingen kompilerad minimatch). Inga E2E- eller vitest-sviter. Ingen UI-QA.
- Ingen läsning av PC-filer. Ingen ändring av originalet.

## UNVERIFIED
- Att 6acd2ef:s filer är exakt de som Codex hashat, och `git diff` tom (Codex-påståenden; hasharna stämmer mot arkivet).
- Datum för nästa stabila typescript-eslint med `^11.0.1`.
- Codex påstår att canary förkastas för batchen. Det är ett beslut, inget att verifiera, och det stöds här.

## Faktisk risk
Låg. Paketet är bara dev/lint och finns inte i produktionsbygget eller i serverns runtime. Den sårbara grenen kräver `optimizationLevel >= 2`, som aldrig sätts. Den enda anropsplatsen är inaktiv eftersom `allowDefaultProject` inte används, och mönstren skulle i så fall vara utvecklarstyrda. CI med fork-PR:er ger ingen ny förmåga utöver den godtyckliga kodkörning som lint redan innebär. **Detta är riskreduktion, inte en patch; audit-fyndet kvarstår (7 moderate).**

## Alternativ
- **(a) Vänta på publicerad stabil (rekommenderas):** main har redan `^11.0.1`. Bevaka `npm view @typescript-eslint/typescript-estree@latest dependencies.minimatch`. Då räcker en vanlig `npm update`.
- **(b) Canary 8.72.3-alpha.x:** har `^11.0.1` men är prerelease och innehåller en experimentell feat. **Avråds** för batchen (i linje med Codex).
- **(c) Avgränsad override minimatch 11.0.8:** fungerade tekniskt i scratch (eslint och tsc gröna, audit 0). Det är dock en **major-override** under en beroendekedja som deklarerar `^10.2.2` och saknar upstream-stöd i stabil release, och full testmatris har inte körts. **Inte rekommenderad.** Om den ändå väljs: flagga den som tillfällig, avgränsa till typescript-estree och ta bort den när en stabil release har `^11`.
- **(d) Acceptera tidsbegränsat (rekommenderas tillsammans med a):** dokumentera GHSA-ID:t, motiveringen ovan och en omprövning vid nästa typescript-eslint-release eller senast inom 2 veckor. Inför ingen `projectService.allowDefaultProject` och ingen `optimizationLevel` innan detta är löst.

Ingen `--force` användes, inga lintregler togs bort, och inget original ändrades.

## Tillägg 19:48 – Codex slutkontroll (UNVERIFIED av QA)
- Codex rapporterar följande, som QA inte har kört: 75 unit och 75 integration på en ny `*_test` med alla 6 migrationer och seed (0 restdata), lint/tsc/build PASS, audit exit 1 med 7 moderate och `--omit=dev` exit 0 med 0. Audit-siffrorna stämmer med QA:s egen scratch-körning (punkt 6).
- Codex `npm pack` av stable 8.72.2 (`^10.2.2`, MIT): minimatch-rangen bekräftas av QA:s egen pack (punkt 3). Licensfältet kontrollerades inte separat.
- Override-proben (punkt 9) kördes innan Codex meddelade att den inte behövdes. Den kördes bara i scratch och ändrade inget i originalet. Den ändrar inte slutsatsen: **override rekommenderas inte**.
