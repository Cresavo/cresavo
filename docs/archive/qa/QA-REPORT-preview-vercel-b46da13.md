# QA-rapport: Vercel-previewanpassning, kandidat b46da13

Granskare: Grok Bot (oberoende, read-only). Datum: 2026-11-12, cirka 15:00–15:25 CET.

## Scope och revision

- **Paket:** `preview-source.zip`.
  - sha256 `26277f7fe00e4fa5413a9fcd48095e07710ecddaa127dbe48da8acd0aed09b71`.
  - Zip-kommentar `b46da1321532ef683e971181d5404f54368e1b95`, 181 filer.
- **Branch:** `preview/epic05-vercel-review`.
- **Bas:** 29ac297. Produktmässigt är basen lika med den godkända 4fc98d3 (skiljer bara i Markdown).
- **Diff:** `b46da13-vs-4fc98d3.patch`, 1374 rader.
- **Ändrade filer:**
  - Konfiguration: `.dockerignore`, `.vercelignore`, `Dockerfile.vercel`, `vercel.json`, `.env.example`, `.gitignore`.
  - Prisma: `schema.prisma` och migration 6 `20261112150000_preview_rate_limit`.
  - Skript: `scripts/server.mjs`, `client-address.mjs`, `database.mjs`.
  - Källkod: `src/lib/rate-limit.ts`, `postgres-rate-limit.ts`, `domain.ts`, `src/app/api/bookings/route.ts`.
  - Tester: 2 nya testfiler.
  - Dokumentation.
- **Oförändrat (VERIFIED, `cmp`):** `package.json`, `package-lock.json` och de 5 historiska `migration.sql`-filerna är byte-identiska med 4fc98d3.
- **Miljö:**
  - Egen embedded Postgres på 127.0.0.1:55581, tidszon Europe/Stockholm, databaser `pv_*_test`.
  - Appportar 3341–3346 och 3000 (E2E). Syntetisk SESSION_SECRET (minst 32 tecken, aldrig utskriven).
  - Endast `@example.test`-data.
  - Ingen åtkomst till PC, Vercel eller Neon. Ingen deploy.

## Körningar (egna)

| Steg | Resultat |
|---|---|
| `npm ci` | VERIFIED PASS. Added 571 packages (Linux). |
| `prisma generate` | VERIFIED PASS, 7.10.1. |
| 6 migrationer + seed på ny DB | VERIFIED PASS. |
| lint / `tsc --noEmit` | VERIFIED PASS / PASS. |
| unit (standardmiljö) | VERIFIED **71/71**. |
| integration (standardmiljö) | VERIFIED **71/71**. Nya `preview-rate-limit.test.ts`: 5/5. |
| unit/integration med global `RATE_LIMIT_STORE=postgres` | Infokörning. Unit 63/71: 8 memory-specifika tester sätter inte store själva. Integration 70/71: cap-testet fick 10004≠10000 på grund av restrader. Se PV-QA-5. |
| build | VERIFIED PASS (Next 16.4.6). |
| E2E, postgres-store, ny DB per läge | dev0 24/24, dev1 24/24, prod1 24/24. prod0 23/24 vid första körningen (MCP `Request timed out` i desktop-test `flow.spec.ts:114`, mobil PASS). Två nya prod0-körningar på nya DB:er: **24/24 + 24/24**. Bedöms som flake; ingen koppling till limitern hittad. |
| `npm audit` | full: 7 moderate / 0 high (typescript-eslint/minimatch-kedjan). `--omit=dev`: 0. |
| Uppgradering 5→6 | VERIFIED PASS. Bas-trädet 4fc98d3 migrerade 5 migrationer, plus seed, 1 admin och 4 bokningar via domänen. Därefter b46da13 `migrate deploy`. md5 för alla 8 gamla tabeller, kolumnschema och constraints är **identiska** före och efter. 6/6 migrationer klara. Ny deploy: "No pending". Ingen drift för RateLimitBucket. |
| pg.log | 0 deadlocks och 0 lock waits >1 s under hela körningen. |
| Docker-imagebygge | **NOT RUN** (docker saknas). |
| No-DB-bygge (ersätter Docker) | VERIFIED PASS. Whitelist-staging enligt `.dockerignore`, `env -i`, dummy `DATABASE_URL=…127.0.0.1:1`, ingen SESSION_SECRET. `npm ci`, `prisma generate`, `build` och `npm prune --omit=dev` lyckades. npm 11.21.1 varnar att install-scripts för prisma, `@prisma/engines` och esbuild inte kördes; bygget lyckades ändå. |
| Wrapper från prunat träd (`--hostname 0.0.0.0`) | VERIFIED. `VERCEL=1` utan `BOOKING_RUNTIME` ger exit 1 + `BOOKING_SERVER_CONFIG_FAILED`. Fullt vercel-läge: READY; utan x-real-ip 400; med x-real-ip 200; fel login 401; `/mcp` och `/api/mcp` 404. Lokalt standardläge OK. |

## Probes (VERIFIED som kodbeteende)

### Konfigurationskombinationer (16 st, startade på riktigt)

- **Avvisas, exit 1 med `BOOKING_SERVER_CONFIG_FAILED`:**
  - vercel utan `VERCEL=1`;
  - vercel utan store, eller med memory;
  - vercel med `TRUST_PROXY_IP` satt till "1", "", eller "true";
  - vercel med `--dev`;
  - `VERCEL=1` utan runtime, eller med `local`;
  - `BOOKING_RUNTIME=Vercel` (versaler);
  - `RATE_LIMIT_STORE=POSTGRES`;
  - `VERCEL=true`;
  - lokalt `TRUST_PROXY_IP=1` utan lista.
- **Startar:**
  - vercel + postgres + `TRUST_PROXY_IP` 0 eller osatt;
  - lokalt `RATE_LIMIT_STORE=redis`: startar och ger sedan **500 per request**, se PV-QA-3.

### Spoofing

- **Lokalt läge:**
  - Fem förfalskade headers per försök (varierad x-real-ip, x-booking-client-ip och proof): 401×5, sedan **429**. Gäller P0 med pg-store, P1 med pg-store och P0 med memory.
  - Ny socket-IP ger 401 (egen bucket).
  - Betrodd proxy 127.0.0.10: varierande x-real-ip ger separata buckets; samma x-real-ip ger 429 vid 6:e försöket.
  - Memory-store skapar 0 DB-rader.
- **Vercel-läge:**
  - Saknad, ogiltig eller kommaseparerad x-real-ip, eller enbart XFF: **400**.
  - Förfalskade x-booking-* och XFF ignoreras: 6:e försöket med samma x-real-ip ger 429.
  - IPv6 accepteras.
  - x-real-ip litas på **från vilken socket som helst**. Detta är avsiktligt.
- **Plattformsbeteende:** säkerheten vilar på Vercels dokumenterade överskrivning ("x-forwarded-for … overwrite … to prevent IP spoofing"; "x-real-ip identical to x-forwarded-for", vercel.com/docs/headers/request-headers). Plattformsbeteendet är **NOT RUN**.

### Limiter (4 prod-processer på samma DB, postgres-store)

- **(a) Gränser över processer:**
  - Login 20 parallella försök: 401×**5**, 429×15. Korrekt lösenord därefter: 429 (aldrig kontrollerat), Retry-After 900.
  - Bokning 40 parallella: 400×**30**, 429×10.
  - Admin 80 parallella: 400×**60**, 429×20.
- **(b) Refund-race:** 3 rundor med 20 korrekta + 20 felaktiga försök. Kontrollerade fel: 3/3/4, aldrig mer än 5. Radens count blev 4/4/4, dvs. i 2 av 3 rundor förlorades en refund. Felet är konservativt. Se PV-QA-2.
- **(c) Utgång enligt DB-klockan:** `UPDATE expiresAt = clock_timestamp()+42s` ger 429 med Retry-After 42. Med `-1s` ger nästa försök 401, ny generation och count 1.
- **(d) Kapacitet och städning:** startläge 9800 aktiva + 200 utgångna rader.
  - Efter 1:a anropet: 9901 rader (100 städade). Efter 2:a: 9802. Efter 3:e: 9803.
  - Vid exakt 10000 rader evikteras den **aktiva** spärrade bucketen X: 429 blev 401. Se PV-QA-4.
  - Latens vid kapacitet: 130 ms/login mot 126 ms vid tom tabell (inklusive 100 ms delay).
- **(e) DB-fel:**
  - Tabellen omdöpt: bokning, korrekt login och fel login gav alla **500**, generisk text, ingen cookie, 0 bokningsrader. `/` gav 200. Efter återställning: login 200.
  - Postgres stoppad: login och bokning gav 500 (113 ms). Efter omstart: 200. Fail closed, ingen memory-fallback.
- **(f) Blandad last:**
  - 40 admin-kedjor (skapa, flytta, avboka), 60 publika bokningar och 60 inloggningar: 0 5xx, 1,8 s. Utfall: admin 201×40 / 200×80; publika 201×60; login 200/401/429.
  - Burst med 150 parallella bokningar mot **en** process (pool=1): 150×400, p50 822 ms, max 1031 ms. Ingen svält och inga timeouts.
- **(g) Felaktiga anrop:**
  - Trasig JSON, form-urlencoded, tom body, 2 MB JSON och ogiltig nyckel ger alla **400**, aldrig 500.
  - Bokningsrutten räknar trasig JSON: efter 30 försök ger nästa 429.
  - `text/plain` med JSON parsas (400 i schema-steget). Content-type kontrolleras inte; Origin-kontrollen finns kvar.
  - Trasig JSON mot login eller admin förbrukar inget (parsas före reservation, ingen KDF).
- **(h) Replay och rollback:**
  - Första anropet 201 (count 1). 12 identiska replays: 201 med samma id, count fortfarande **1**.
  - Samma nyckel med annan payload: 409, count 2. Upptagen tid: 400, count 3. Rollback förbrukar alltså försöket.

## Fynd

**PV-QA-1 — Medium — BLOCKER för DEPLOY-CONFIG**

- **Problem:** `.vercelignore:1–21` använder `**` följt av `!src/**` m.fl. Mönstret undantar katalogerna själva. Vercel CLI:s egen filinsamlare (`@vercel/client` 18.11.2: ignore 4.0.6 + readdir som hoppar över ignorerade kataloger) kliver därför aldrig ner i `src/`, `scripts/`, `prisma/` eller `docs/`.
- **Repro (offline, båda radbrytningsvarianterna):** `buildFileTree(<kandidat>, {isDirectory:true})` ger **15 filer**, bara toppnivå. `src/`, `scripts/`, `prisma/` och `docs/DEPENDENCY_REVIEW.md` saknas. `git` och ignore 5.3.2 ger samma resultat.
- **Följd:** en `vercel deploy` skulle bygga Dockerfile utan applikationskod. Bygget misslyckas, eller ger en trasig image. Inget läckage: `.env` exkluderas.
- **Ej verifierat:** Git-integrationens serverbeteende är NOT RUN.
- **Riktning:** rotförankrad allowlist (`/*`, `!/src`, `!/scripts`, `!/prisma`, `!/docs`, `/docs/*`, `!/docs/DEPENDENCY_REVIEW.md` …). Mitt utkast i scratch gav 93 filer, 0 `.env`, 0 tester. Lägg till ett test som kör `@vercel/client` `buildFileTree` (eller motsvarande) och kontrollerar att `src/app/**` finns och att `.env*` och `tests/**` saknas. `.dockerignore` (Docker-semantik) är NOT RUN; gör den gärna i samma stil.

**PV-QA-2 — Low — backlog**

- **Problem:** `postgres-rate-limit.ts:60–67` gör refund utanför advisory-låset och transaktionen. Det ger lost update.
- **Mätning:** count 4 mot 3 faktiska misslyckade kontroller.
- **Bedömning:** felet är konservativt och ger aldrig för mycket refund. En legitim admin kan förlora ett försök per race.
- **Riktning:** gör refund i samma låsta transaktion, eller som ett atomiskt villkorat `UPDATE … count-1` under samma lås.

**PV-QA-3 — Low — backlog**

- **Problem:** `server.mjs:22–27` validerar varken `RATE_LIMIT_STORE` (lokalt) eller SESSION_SECRET (vercel) vid start.
- **Följd:** processen blir READY men svarar sedan 500 per request. Det är fail closed, men felet syns sent.
- **Riktning:** anropa store-policyn och kontrollera secret-längden i wrappern före `listen`.

**PV-QA-4 — Low — känd design, pilotgrind**

- **Problem:** `postgres-rate-limit.ts:42–47` evikterar den äldsta raden även om den är aktiv och spärrad.
- **Följd:** en aktör med ≥10000 identiteter (t.ex. IPv6-/64:or) kan nollställa spärrar. Detta är samma egenskap som memory-designen.
- **Mitigering:** previewn ligger bakom all-deployment-auth.

**PV-QA-5 — Low — testhygien, backlog**

- **Teardown (bekräftar Codex fynd 1):** E2E lämnar **30** RateLimitBucket-rader (HMAC-nycklar) i varje E2E-DB. Gäller alla 6 mina E2E-DB:er; övriga tabeller har 0 rader. Teardown bör rensa tabellen.
- **Cap-testet:** `preview-rate-limit.test.ts:114` förutsätter tom tabell.
- **Unit-tester:** säkerhetstesterna sätter inte `RATE_LIMIT_STORE=memory` själva.

**PV-QA-6 — Info — operativ grind, NOT RUN**

- **Port:** imagen sätter `ENV PORT=3000` och `USER node`. Vercels Container-dokumentation anger standardport 80, som kan ändras via PORT i projektinställningarna. Kontrollera att PORT=3000 faktiskt gäller i driften.
- **x-real-ip:** alla anrop utan x-real-ip ger 400. Bekräfta att plattformens health/ingress alltid sätter headern.

## Licens- och artefaktfakta (inga slutsatser om licensklarering)

- **Prunat Linux-träd** (`npm prune --omit=dev`, 144 toppkataloger, 742 MB) innehåller fortfarande:
  - prisma 7.10.1, @prisma/studio-core 0.33.0, elkjs 0.11.1 (kedja: `@prisma/client` → prisma);
  - typescript 5.9.3 (peerOptional i `@prisma/client`);
  - @playwright/test och playwright 1.65.0 (peerOptional i next);
  - @img/sharp-linux-x64 0.35.5 (Apache-2.0) och sharp-libvips-linux-x64 1.3.4 (LGPL-3.0-or-later);
  - @node-rs/argon2-linux-x64-gnu 2.2.2.
  
  Detta **bekräftar Codex fynd 2**.
- **THIRD_PARTY_NOTICES:**
  - Rad 5 namnger argon2-binären för win32, men inte linux-x64-gnu. Rad 7 har en generell grind för "binary/container distribution".
  - Rad 14 nämner CLI/Studio/elkjs.
  - `DEPENDENCY_REVIEW.md:42` säger fortfarande att "ingen … container görs". Det är inaktuellt för en Vercel-image.
- **Bedömning:** detta är den kända grinden E03-QA-2 plus argon2-plattformsnotisen. Det är inte en kodblocker för previewn. Prod-audit 0 innebär ingen binär- eller licensklarering.

## Codex påståenden

| Påstående | Klass |
|---|---|
| `npm ci` 570 paket | Bekräftat i sak. 571 på Linux (plattformsberoende). |
| `generate` 7.10.1; 6 migrationer + seed; lint/tsc | Bekräftat. |
| 71 unit / 71 integration (5 nya) | Bekräftat i standardmiljö. |
| 24 E2E × dev0/dev1/prod0/prod1 med postgres | Bekräftat. prod0 hade en MCP-timeout-flake, sedan 2× 24/24. |
| 4 processer: 5 kontroller, 15/20 spärrade | Bekräftat (eget test via HTTP och testsviten). |
| Refund-generation, utgång, ruttisolering, cap 10000, ingen memory-fallback | Bekräftat. Men refund kan gå förlorad (PV-QA-2) och cap evikterar aktiva buckets (PV-QA-4). |
| audit 7 moderate / 0 high; prod 0; no-DB-bygge PASS | Bekräftat (no-DB-bygge utan Docker). |
| E2E lämnar 30 RateLimitBucket-rader | **Bekräftat** (30 i alla 6 DB:er). |
| Prune behåller CLI/Studio/elkjs | **Bekräftat.** Även typescript, playwright och sharp/libvips. |
| Paketeringsförslag `npm ci --omit=dev --omit=peer --omit=optional --ignore-scripts` | Ej i kandidaten, UNVERIFIED som leverans. Se prototypkontrollen nedan. |
| argon2 Linux-provenans/Cargo/notispaket | Overifierbart, ej i kandidaten. |
| Vercel-auth för alla deployments med endast Niclas i teamet; Neon Free Frankfurt 18.6, endast preview-target, begränsad approll | Overifierbart (kontofakta). |

**Prototypkontroll (inte kandidatverifiering, scratch på Linux):**

- `npm ci --omit=dev --omit=peer --omit=optional --ignore-scripts` gav 53 paket och 0 prisma/elkjs/sharp/typescript/playwright (340 MB). argon2-linux-bindningen saknades.
- Med manuellt kopierad `.prisma`-klient, argon2-binding och `next.config.mjs` gav wrappern i vercel-läge: `/` 200, login 401×5 och sedan 429, korrekt login 200.
- Kopieringsstegen finns inte i någon Dockerfile och är overifierade.

## Saknade tester

- Uppladdningslista (`.vercelignore`) i CI, se PV-QA-1.
- Refund under samtidighet med invariant count = antal faktiska fel.
- Startvalidering av store och secret.
- Teardown av RateLimitBucket.
- Docker-image (eller motsvarande Linux-bygge) i CI.
- Eviktion av aktiv bucket vid 10000 rader dokumenterad i test.

## Beslut

- **CODE** (wrapper, ingress-policy, Postgres-limiter, migration 6, regressioner): **GO** som kandidat för operativ verifiering. Inga kodblockerare; PV-QA-2..5 är backlog.
- **DEPLOY-CONFIG: NO-GO** tills PV-QA-1 är rättad. En Vercel-uppladdning via CLI saknar applikationskoden. Rättningsvarv 1 av 2: se `FIX-REQUEST-preview-vercel-b46da13.md`.
- **Kända grindar utanför denna blocker:** E03-QA-2 (CLI/Studio/elkjs i prod-trädet), argon2/libvips-plattformsnotiser, PV-QA-4, MFA/identitetslivscykel samt export/retention.
- **NOT RUN:**
  - faktisk Vercel-deploy och Docker-image;
  - spoofing på den riktiga plattformen och x-real-ip-överskrivning;
  - TLS och skydd av alla sökvägar;
  - logout och flöden i drift;
  - beständighet, backup och återläsning;
  - Neon;
  - fysisk iPhone.

Loggar och probes: `run-b46da13/logs/` (summary.log, summary2.log, `p-config.json`, `p-lim.json`, `p-pruned.json`, `p-proto.json`, `up-*.txt`) och `run-b46da13/probes/`.
