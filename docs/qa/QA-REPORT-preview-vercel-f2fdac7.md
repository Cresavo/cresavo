# QA-rapport: preview-rättningsvarv 1, kandidat f2fdac7

Granskare: Grok Bot (oberoende, read-only). Datum: 2026-11-12, cirka 15:50–16:00 CET.

## Revision och scope

- **Paket:** `preview-source-fix1.zip`.
  - sha256 `2190e0943354b05466058d29fa0758e5c3917763d20040660f4619def52dd5a3`.
  - Zip-kommentar (commit) `f2fdac700125df2d212e824555758b8ed6d6a7a7`.
  - 189 filer. Endast `.env.example` finns.
- **Jämförelse:** mot b46da13, patch `f2fdac7-vs-b46da13.patch`.
- **Ändrad produktkod (exakt):**
  - `src/lib/postgres-rate-limit.ts:60–71`: refund sker nu i en transaktion med samma advisory-lås som reservationen.
  - `scripts/client-address.mjs:8–9, 15–27`: store-validering i alla lägen. I vercel-läget valideras dessutom SESSION_SECRET (minst 32 tecken) och syntaxen i `DATABASE_URL`.
- **Övriga ändringar (paketering, test, dokumentation):**
  - `.vercelignore`, `.dockerignore`, `Dockerfile.vercel`, `.gitattributes`;
  - nya `scripts/preview-files.mjs` och `scripts/compile-runtime-config.mjs`;
  - `tests/e2e/global-teardown.ts` och `playwright.config.ts` (globalTeardown);
  - `tests/preview-files.test.ts` (ny), samt `tests/integration/preview-rate-limit.test.ts` och `tests/preview-runtime.test.ts` (ändrade);
  - `THIRD_PARTY_NATIVE_NOTICES.txt` (ny), `THIRD_PARTY_NOTICES.md`, `docs/*`.
- **Oförändrat (VERIFIED, `cmp`):** `package.json`, `package-lock.json`, alla 6 `migration.sql`-filer och `schema.prisma`. Bokningsregler (`domain`, `booking-mutations`) och auth-koden ingår inte i diffen.
- **Miljö:**
  - Egen Postgres på 127.0.0.1:55591, tidszon Europe/Stockholm, databaser `f1_*_test`.
  - Appportar 3351–3356 och 3000 (E2E).
  - Endast syntetiska data.
  - Ingen åtkomst till PC, Vercel eller Neon. Ingen deploy.

## Körningar (egna)

| Steg | Resultat |
|---|---|
| `npm ci` / generate / migrate 6 + seed / lint / tsc | VERIFIED PASS. 571 paket, Prisma 7.10.1. |
| unit / integration | VERIFIED **72/72** / **72/72**. Rate-testet 6/6. |
| build | VERIFIED PASS. |
| E2E, `RATE_LIMIT_STORE=postgres`, fyra nya DB:er | VERIFIED dev0 **24/24**, dev1 24/24, prod0 24/24, prod1 24/24. Ingen flake och inga timeout-ändringar. |
| RateLimitBucket efter E2E | 30 inserts per läge, **0 kvarvarande rader** i alla fyra DB:er. |
| audit | full: 7 moderate / 0 high. `--omit=dev`: 0. |
| Vercels riktiga `buildFileTree` (`@vercel/client` 18.11.2, offline) | VERIFIED. Se PV-QA-1 nedan. |
| Image-bygge med Docker/podman | **NOT RUN.** Docker saknas, och apt blockeras av egress-proxyn (500/SSL-fel). Jag återställde apt-källorna. |
| Emulerad image | VERIFIED approximation. Riktig rootfs från `node:24-bookworm-slim` (amd64-digest `sha256:0e2646ab…80e`, node 24.22.3) körd med `unshare -Urm` + chroot. Byggsteget och runtime-steget följer `Dockerfile.vercel` rad för rad. Se nedan. |

### Emulerad image (Dockerfile.vercel)

- **Avvikelser från ett riktigt bygge:**
  - Build-kontexten togs fram med git-semantik från `.dockerignore`: 97 filer, inga `.env` eller `*.key`.
  - `USER node` och `--chown` emulerades inte; processen kördes som mappad root.
- **Byggsteget:**
  - `npm ci`: 571 paket.
  - `prisma generate`, build med dummy-DB, `compile-runtime-config` (MJS) och tar-steget: alla PASS.
- **Runtime-steget:**
  - `npm ci --omit=dev --omit=peer --omit=optional --ignore-scripts` gav **53 paket**.
  - `test ! -d` passerade för prisma, elkjs, sharp och typescript. `@prisma` innehåller ingen studio.
  - argon2-guarden: binären har sha256 `0f4e6088…14b2`, guard OK. En kopia med 1 manipulerad byte gav `PREVIEW_NATIVE_ARTIFACT_REFUSED`.
- **Wrappern** (lyssnar på `0.0.0.0:3356`, vercel-läge mot lokal test-DB):
  - utan x-real-ip: 400;
  - `/` och `/admin`: 200;
  - login 401×5, sedan **429**; korrekt admin-login 200 (cookie Secure, HttpOnly, SameSite=Strict);
  - publik bokning 201, med 1 DB-rad;
  - `/mcp`, `/api/mcp`, `/sse`, `/api/mcp/sse`: 404;
  - HSTS sätts.
- **Källarkiv i imagen:** `booking-lab-source.tar.gz` finns, 188 KB och 135 poster. Det innehåller src (84 poster), scripts, 6 migrationer, Dockerfile, lockfile, LICENSE och notiser. Inga `.env` utöver `.env.example`, inga tester.

## Status för tidigare fynd

**PV-QA-1: STÄNGD.**

- **Vercels riktiga `buildFileTree` på kandidaten** gav **97 filer**, och Codex siffror stämmer:
  - 32 filer under `src/app`, 6 `migration.sql`;
  - docs endast `docs/DEPENDENCY_REVIEW.md`;
  - notiser: LICENSE, `THIRD_PARTY_NOTICES.md` och `THIRD_PARTY_NATIVE_NOTICES.txt`;
  - env endast `.env.example`; 0 tester; 0 `.vercel`; 0 key/pem/private.
- **Med fientliga extrafiler:** jag lade till `.env`, `.env.local`, `.env.production`, `.vercel/project.json`, `src/sub/.env`, `scripts/operator.private.json`, `src/local.key`, `prisma/cert.pem`, `docs/OPERATOR.md`, `node_modules` och `.next`. Ingen av dem kom med. Enda skillnaden är en tom katalogpost `src/sub`.
- **Hjälpskriptet** `previewFiles` ger exakt samma lista som Vercel.
- **Regressionstestet** `tests/preview-files.test.ts`: PASS med den nya filen. Mot b46da13:s `.vercelignore` blir det FAIL ("expected ['.env.example'] to include 'src/app/page.tsx'").

**PV-QA-2: STÄNGD.**

- 6 rundor med 40 parallella inloggningar över 4 processer.
- Radens count är exakt lika med antalet kontrollerade fel i alla rundor (3/3/2/3/3/3). Varken förlorad eller för stor refund.
- 0 deadlocks och 0 lock waits >1 s.

**PV-QA-3: STÄNGD för vercel-läget.**

- **Avvisas, exit 1 med `BOOKING_SERVER_CONFIG_FAILED`:**
  - `RATE_LIMIT_STORE` satt till `redis` eller `""` (även lokalt);
  - vercel-läget med:
    - SESSION_SECRET saknas eller är 31 tecken;
    - `DATABASE_URL` saknas, är `mysql://`, är skräp, saknar DB-namn, eller är en ren socket-URL.
- **Startar:**
  - lokalt standardläge och lokalt med postgres-store;
  - vercel-läget med en secret på 32 tecken.
- **Ej startvaliderat:** en syntaktiskt giltig men onåbar PG-URL startar och ger sedan 500 per request (fail closed). Jag godtar det.
- **Lokalt läge:** secret och URL valideras inte vid start, eftersom Next laddar `.env` först. Det är oförändrat och utanför scope.

**PV-QA-5: STÄNGD (huvuddelen).**

- Teardown lämnar 0 rader.
- Teardown vägrar köra mot:
  - DB-namnen `postgres` och `f1_prod`;
  - fjärrvärd;
  - URL med `?host=`;
  - osatt URL.
  
  Felet är `TEST_DATABASE_REFUSED`.
- Kapacitetsfixturen klarar 190 redan befintliga rader (150 utgångna): 6/6. Integration med global postgres-env: 72/72.
- **Kvar:** unit med global `RATE_LIMIT_STORE=postgres` ger 64/72. Se PV-QA-7.

**PV-QA-4: ÖPPEN, låg backlog.** Eviktion av aktiv bucket vid 10000 rader är oförändrad; probe X gick från 429 till 401.

**Regressionsprober, 4 processer:**

- **Gränser:** login 5 kontroller (sedan 429, även för korrekt lösenord); bokning 30; admin 60.
- **Utgång:** följer DB-klockan (Retry-After 42 s, efter utgång 401).
- **Replay och rollback:** replay är gratis; konflikt och upptagen tid förbrukar ett försök.
- **Städning och kapacitet:** 100 utgångna rader per anrop.
- **Blandad last:** 0 5xx. Burst med 150 anrop mot en process: max 512 ms.
- **DB-fel:** omdöpt tabell eller stoppad Postgres ger 500 utan cookie och utan bokningsrad. Efter omstart: 200.

## Nya fynd (inga blockerare)

**PV-QA-7 — Low — testhygien, backlog**

- **Problem:** åtta memory-specifika säkerhetstester i `tests/security.test.ts` fastställer inte `RATE_LIMIT_STORE=memory`. Om variabeln är exporterad som postgres blir resultatet 64/72.
- **Riktning:** `vi.stubEnv("RATE_LIMIT_STORE","memory")` i den describe-blocket.

**PV-QA-8 — Info — grind före fler användare**

- **Läge:** källarkivet ligger i imagen men erbjuds inte över nätet (AGPL §13). Det räcker för en privat preview där licensgivaren själv är enda användare.
- **Före fler användare:** lägg in ett källerbjudande, till exempel en länk till arkivet eller repot.

## Licens- och paketeringsgrind (endast denna privata preview)

**Kontrollerat konkret:**

- **Linux-binären** `@node-rs/argon2-linux-x64-gnu` 2.2.2 är namngiven med version. Dess sha256 `0f4e6088…14b2` är densamma i `NATIVE_NOTICES` rad 2, `THIRD_PARTY_NOTICES` rad 19–21, Dockerfile-guarden och den faktiska binären.
- **Crate-listan:** 57 rader. Alla 57 checksummor stämmer mot crates.io-index, som jag hämtade själv. `Cargo.lock` ingår inte, så att listan är **komplett** är overifierbart.
- **Dubbellicenser:** valet av MIT anges (`NATIVE` rad 6, `NOTICES` rad 32). ISC-text (libloading) och UNICODE LICENSE V3 (unicode-ident) finns. Rust std har COPYRIGHT och LICENSE-MIT.
- **Provenance-signaturen** anges uttryckligen som inte kryptografiskt verifierad (`NOTICES` rad 23–24).
- **Runtime-trädet** saknar CLI, Studio, elkjs, sharp/libvips och TypeScript. Källarkivet ingår.

**Bedömning:** räcker för en privat, auth-skyddad preview med en enda tenant.

**Kvar före en publik binärrelease:**

- verifierad provenance-signatur;
- fullständig closure från `Cargo.lock` och en länkad SBOM;
- källerbjudande över nätet (PV-QA-8);
- notiser för Debian- och Node-basimagen;
- de gamla grindarna för CLI/ELK och sharp om de komponenterna återinförs;
- andra plattformar.

## Codex påståenden

| Påstående | Klass |
|---|---|
| lint/tsc/build PASS | Bekräftat. |
| 72 unit / 72 integration, rate-test 6/6 | Bekräftat. |
| 97 filer / 32 app / 6 migrationer / rätt docs och notiser / endast `.env.example` | Bekräftat med Vercels riktiga `buildFileTree`. |
| 53 paket, inga CLI/Studio/ELK/sharp/TS i runtime | Bekräftat (emulerat Linux-steg). |
| Minimal Windows-runtime 24 E2E | Overifierbart (Windows). Linux-emuleringen ovan är oberoende. |
| dev0 23/24 en gång | Overifierbart. Hos mig 24/24 i alla fyra lägen. |
| Krypterad Neon-backup återläst, 10 lika tabellhashar | Overifierbart. |
| 57 crates verifierade | Delvis bekräftat: 57/57 checksummor stämmer mot crates.io. Fullständighet mot `Cargo.lock` är overifierbar. |
| Historiska migrationer, bokningsregler och auth oförändrade | Bekräftat. |

## Beslut

- **KOD och PAKETERING: GO** som kandidat för Codex operativa verifiering.
- **Blockerare:** inga. Ingen fix-request skrivs.
- **Backlog:** PV-QA-4, PV-QA-7 och PV-QA-8.
- **NOT RUN:**
  - riktigt OCI-imagebygge (Docker/podman/BuildKit) och körning som `USER node`;
  - Vercel-deploy, TLS, perimeter och skydd av alla sökvägar;
  - plattformens överskrivning av x-real-ip och XFF;
  - admin, bokning, logout och beständighet i drift (Codex);
  - Neon;
  - fysisk iPhone (Niclas).

Loggar och probes: `run-f2fdac7/logs/` (`summary.log`, `p-startup.json`, `p-lim.json`, `p-image.json`, `vercel-filelist-*.txt`, `img-*.log`) och `run-f2fdac7/probes/`.
