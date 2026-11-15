# QA-rapport — Epic 04 individuell lokal adminåtkomst — 3419973

**Granskare:** Booking Lab QA (Grok Bot), oberoende och read-only
**Datum:** 2026-11-12, 07:31–07:47 CET (Europe/Stockholm)
**Revision:** `3419973b151141e034a8600e3f807750f9500d76` (branch `epic-04-individual-admin`, bas `10175ed`)
**Miljö:** endast boxen, `/workspace/qa/booking-lab-se/run-3419973/`. Egen embedded-postgres på port **55541** med serverns `timezone=Europe/Stockholm`. Webb på **3310/3311**. Playwright hårdkodar port 3000 (boxen är isolerad, ingen Codex där), se E04-QA-5. Inget kördes på PC:n och ingen kod ändrades. Alla data är syntetiska (`@example.test`). Codex `.env` lästes inte; boxens `.env` är min egen syntetiska fil.

## Sammanfattning

**Lokal POC: GO.** **Pilot: NO-GO** (oförändrat: MFA, GDPR, TLS och distribuerat missbruksskydd/flerinstans saknas fortfarande).

Alla acceptanskriterier E04-1…E04-7 som jag kunde köra är **PASS**:

- Två konton fungerar var för sig.
- Logout, reset och spärr påverkar bara rätt konto och gäller direkt.
- Jag körde 180 race-varv reset↔login och 75 varv disable↔login. Ingen gammal session överlevde (0 överträdelser).
- `ADMIN_PASSWORD` ger ingen fallback.
- Svaret är ett generiskt 401 med jämn KDF-timing.
- 300 samtidiga gissningar från en klient gav högst 5 verifieringar (uppmätt: 4).
- KDF-taket är 4, utan kö, och platsen frigörs även när verifieringen kastar fel.
- Uppgraderingen 3→4 gav ingen dataförlust, och gamla cookies nekas.
- Hela matrisen är grön.

**Inga blockerare, och därför ingen FIX-REQUEST.** Ett nytt fynd av medelallvar (E04-QA-1) gäller lockout-förstärkning vid KDF-mättnad. Det är en idé/pilotfråga och inte en POC-blockerare, men fixen är liten.

## 1. Revision och diff

| Kontroll | Resultat |
|---|---|
| ZIP SHA256 | `8757e056a47a8de48cbe59a6bc086f5c99b4d4c5c69811551b9e59053ae68515`. **VERIFIED**, stämmer med PC. |
| ZIP-kommentar | `3419973b151141e034a8600e3f807750f9500d76`. **VERIFIED**. |
| Innehåll | Bara `.env.example`. Ingen `.env`, `node_modules`, `.next` eller databas. **VERIFIED**. |
| Diff mot min 18a4d73-tree (CRLF-normaliserad) | Alla icke-dokumentfiler som skiljer finns exakt i den angivna listan base..head: `.env.example`, `verify.yml`, `package(-lock).json`, `playwright.config.ts`, `schema.prisma`, ny migration, `scripts/admin.mts`, `scripts/test-cleanup.mjs`, `src/app/admin/{page,ui}.tsx`, `api/admin/login/route.ts`, `src/lib/{admin-accounts,auth,config,domain,password,rate-limit}.ts` och tester. Övriga skillnader är bara `docs/*` (bland annat ny `LOCAL_DEMO_WINDOWS.md` och `docs/qa/QA-REPORT-epic03-18a4d73.md`). **VERIFIED:** 1e33c65/e086b67/10175ed har inte ändrat src/prisma/scripts/package. (Ingen git-historik i ZIP:en; slutsatsen bygger på att varje kodskillnad finns i base..head-listan. `src/lib/config.ts` saknas i 18a4d73 och är ny i Epic 04.) |
| Tre första migrationerna | `cmp` gav alla tre identiska. **VERIFIED** |
| Fjärde migrationen | Additiv: `CREATE TABLE "AdminUser"` plus `ALTER TABLE "AdminSession" ADD COLUMN "userId" TEXT` (nullable), FK `ON DELETE RESTRICT` och index. Inga DROP eller ändrade kolumner. **VERIFIED** |
| package.json | Lägger bara till `"@node-rs/argon2": "2.2.2"` (exakt pin) och skriptet `admin:manage`. Låsfilen har 14 nya poster: wrapper + 13 plattformspaket, alla MIT. Inget borttaget eller versionsändrat. **VERIFIED** |

### CI utan ADMIN_PASSWORD (läsresonemang, CI NOT RUN)

CI bör **inte** fallera för att `ADMIN_PASSWORD` togs bort ur `verify.yml`:

- E2E-fixturen (`tests/e2e/fixtures.ts`) skapar per test ett syntetiskt konto via `createAdminUser` mot jobbets `DATABASE_URL`, och raderar konto och sessioner efteråt.
- Integrationstesterna skapar sina egna konton.
- `playwright.config.ts` sätter `ADMIN_PASSWORD` till en kanariesträng som aldrig får autentisera.
- `touch .env` och `--env-file` fungerar som förut.
- Låsfilen innehåller `@node-rs/argon2-linux-x64-gnu`, så ubuntu-runnern får nativebindningen.

Jag körde samma flöde lokalt med tom `ADMIN_PASSWORD` i skalet: 4×14 E2E PASS. **Inte verifierat i GitHub** eftersom inget är pushat.

## 2. Slutmatris (ren installation, Node 24.22.1, TZ=Europe/Stockholm)

| Steg | Resultat |
|---|---|
| `npm ci` | PASS. 571 paket. Varning om install-scripts gäller prisma/@prisma/engines/esbuild, inte argon2. |
| `prisma generate` / migrate (4) / seed | PASS / PASS / PASS. 0 konton efter seed, alltså inget standardkonto. |
| lint / `tsc --noEmit` / build | PASS / PASS / PASS. |
| unit | **58/58** PASS. |
| integration ×3 | **40/40, 40/40, 40/40** PASS. |
| E2E dev proxy0 / dev proxy1 / prod proxy0 / prod proxy1 | **14/14** i alla fyra (28.7 s / 27.4 s / 17.5 s / 18.5 s). |
| Städning (timeout-städprob) | `CLEANUP_TIMEOUT_EXPECTED_EXIT=1; REMAINING_SYNTHETIC_ROWS=0; PASS`. Aggregat efter matrisen: booking/campaign/session/admin/overlap = 0/0/0/0/0. |
| Deadlocks | 1. Det är det kända testfallet E03-QA-1 med direkta ORM-writes utan advisory lock (PG-logg: `INSERT ... while checking exclusion constraint`). Produktvägen påverkas inte. |
| `npm audit` full | exit 1: **7 moderate / 0 high** (typescript-eslint → minimatch, samma kedja). |
| `npm audit --omit=dev` | exit 0: **0**. |

## 3. Codex påståenden

| Påstående | Status |
|---|---|
| AdminUser + additiv 4:e migration; 3 tidigare byteidentiska | **CONFIRMED** |
| Exakt `@node-rs/argon2` 2.2.2, MIT | **CONFIRMED.** Wrapperns LICENSE är MIT (© LongYinan). `@node-rs/argon2-linux-x64-gnu` 2.2.2 deklarerar MIT men har **ingen LICENSE-fil**, bara README, package.json och `.node` (728 KB). I binären syns de statiskt länkade Rust-cratesen `argon2-rust-1.1.0`, `napi-3.12.1` och `rand-0.10.2`, sannolikt fler. Native-inventeringen förblir en distributionsgrind (E04-QA-4). |
| Argon2id v19, m=19456, t=2, p=1, 32 B | **CONFIRMED.** Hashprefixet i DB är `$argon2id$v=19$m=19456,t=2,p=1$` med längd 97. Klartext finns inte i kolumnen. |
| Strikt e-post/lösenord, bara `example.test`, ingen `ADMIN_PASSWORD`-fallback, generiskt 401 | **CONFIRMED** (§4.1–4.3) |
| Signerad hash-only-session och global version kvar; legacy-rader med `userId` NULL nekas | **CONFIRMED** (§4.4 och §5). Den råa token finns inte i DB (0 rader med token som id). En höjning av `ADMIN_SESSION_VERSION` till 2 nekar befintlig cookie. |
| Varje åtkomst kräver aktivt konto | **CONFIRMED.** Adminytan består av `/admin` (SSR), `/api/admin/publish` och `/api/admin/logout`. Det finns **inga server actions** (`"use server"` saknas i `src`). |
| Radlås och versionskontroll före session; reset/spärr i samma tx; inga återupplivade sessioner | **CONFIRMED** (kod: `SELECT … FOR UPDATE` och jämförelse av `credentialVersion`; race-test i §4.5) |
| CLI-lösenord via dold TTY/stdin, aldrig argv | **CONFIRMED** (§4.7) |
| Asynkron limiter reserverar före await, max 4 KDF, ingen kö, platsen frigörs vid throw | **CONFIRMED** (§4.6). Bieffekten finns i E04-QA-1. |
| 58 unit / 40 integration ×3 / 14 E2E ×4 / audit 7 mod, prod 0 / städning / aggregat 0 | **CONFIRMED** med egna körningar. Mina tider skiljer sig (dev0 29 s mot 1.5 min), vilket inte är relevant. |
| Extern uppgradering 3→4 behåller data; legacy `userId` NULL; 0 auto-admins | **CONFIRMED** (§5) |
| Windows-TTY utan eko | **UNVERIFIABLE** (Windows). Linux-pty: inget eko, se §4.7. |
| Slutdemo vid 9282cdc (docs-only), 5d389da docs-only, Epic 02/03 gröna CI | **UNVERIFIABLE.** Utanför min frysta revision; jag har inte fått de commitarna. |

## 4. Riktade säkerhetsprober (prod-server, egna skript utanför repot)

KDF-anrop räknades med en harness-hook (`node --require probes/kdf-hook.cjs`). Den wrappar `@node-rs/argon2` `verify`/`hash`, även Turbopacks hashade externa namn `@node-rs/argon2-d87c2b703f45c451`, och loggar bara räknare. Produktkoden ändrades inte. Rålogg och JSON finns i `run-3419973/logs/p-*.json`.

### 4.1 Konton och CLI (E04-2) — PASS

`npm run admin:manage`-ekvivalent (`node --env-file=.env --import tsx scripts/admin.mts <cmd> <email>`, lösenord via stdin):

- create A/B/C: `ADMIN_COMMAND_OK`, exit 0.
- Dubblett (`A` med versaler): `ADMIN_ACCOUNT_EXISTS`, så normaliseringen fungerar.
- `@example.com`: `ADMIN_INPUT_INVALID`.
- Lösenord på 5 tecken: `ADMIN_INPUT_INVALID`.
- Mismatch: `ADMIN_PASSWORD_MISMATCH`.
- Extra argv-argument: `ADMIN_COMMAND_INVALID`, och CLI:t läser då inte stdin alls.
- reset på spärrat konto och disable på saknat konto: `ADMIN_ACCOUNT_NOT_FOUND`.

Ingen CLI-utdata innehöll lösenord eller `$argon2`.

### 4.2 Ingen fallback (E04-3) — PASS

Servern startades med `ADMIN_PASSWORD=qa-canary-legacy-admin-password-2026`. Fem login-varianter gav alla **401 `{"error":"Fel inloggningsuppgifter"}`** utan cookie: `{password}`, `{email:A,password:canary}`, `{email:"admin@example.test",…}`, tom e-post, och extra `businessId`.

### 4.3 Generiskt 401 och timing (E04-3/E04-6) — PASS

20 försök per fall, varje från en egen klient-IP:

| Fall | Status/body | Median (p10–p90) | KDF-anrop |
|---|---|---|---|
| Okänd e-post | 401, samma body | 123.5 ms (120.5–144.1) | 20/20 (dummyhash) |
| Fel lösenord | 401, samma body | 120.6 ms (118.1–124.8) | 20/20 |
| Spärrat konto med rätt lösenord | 401, samma body | 119.1 ms (116.7–121.1) | 20/20 (dummyhash) |
| Fel domän / password-only | 401, samma body | 104 ms | 0 (formatfel, ingen kontoinformation) |

Med 60 interfolierade par blev medianen okänd 120.0 ms mot fel lösenord 120.1 ms. Jag ser ingen användaruppräkning. Svaret vid formatfel är ~15 ms snabbare men säger inget om huruvida ett konto finns.

### 4.4 Två konton, logout, reset och spärr (E04-4) — PASS

- A och B loggar in. `/admin` visar "Inloggad som <egen e-post>", och kund-e-post förblir maskerad.
- A:s lösenord på B och tvärtom ger 401.
- Cookie: `HttpOnly; SameSite=strict; Secure` (prod), Max-Age 28800. Login- och logout-svar har `Cache-Control: no-store`.
- Manipulerad cookie (A:s token + B:s signatur): ej inloggad.
- **Logout av A:s session 1:** kopierad cookie ger ej inloggad och publish 403. A:s andra session och B fungerar. Logout utan Origin ger 403.
- **Reset av A via CLI:** A:s gamla session ger publish 403. B opåverkad. Gammalt lösenord 401, nytt 200.
- **Spärr av B via CLI:** B:s befintliga cookie avvisas direkt vid nästa request (`/admin` ej inloggad, publish 403). A opåverkad. Login B ger 401.
- **Direkt DB-återaktivering av B** (`active=true`): den gamla cookien är fortfarande ogiltig. Bara ny login fungerar.

### 4.5 Race reset/spärr ↔ login (E04-4) — PASS

En varm operatörsprocess anropar samma `resetAdminPassword`/`disableAdminUser` som CLI:t. Den startar 0–60 ms efter en login som pågår med det gamla lösenordet. Efteråt kontrollerade jag om login-cookien ger åtkomst.

- **Reset:** 3×60 = 180 varv. Utfall: login 200 men cookien ogiltig 116, login 401 64. **0 överträdelser.**
- **Spärr:** 3×25 = 75 varv. Utfall: 200/ogiltig 35, 401 40. **0 överträdelser.**

Båda utfallen förekommer, så racet träffades verkligen. Efteråt fanns 0 levande sessioner för racekontona och inga nya deadlocks.

### 4.6 Limiter och KDF-kapacitet (E04-5) — PASS, med E04-QA-1/2

| Prob | Resultat |
|---|---|
| 300 samtidiga gissningar, en klient (proxy1, `X-Real-IP` via 127.0.0.10), blandade e-poster | 4×401 + 296×429, **4 KDF-anrop (≤5)**. Retry-After 900 (limitern) eller 1 (KDF-taket). Minsta latens 415 ms (≥100 ms). |
| Rätt lösenord från samma klient efteråt | **429 utan KDF**, Retry-After 900. |
| Rätt lösenord från en annan klient | **200**. Ingen global lockout (Epic 01-problemet är inte tillbaka). |
| Opålitlig peer som skickar `X-Real-IP` | Headern ignoreras: 5×401 + 2×429 på peerns egen bucket. |
| 300 gissningar med roterande IPv6 inom samma /64 | **5 KDF**, 295×429. `/64`-gruppering via `clientLimitKey` fungerar. |
| 300 gissningar med roterande IPv4 (300 adresser) | **300 KDF**, se E04-QA-2. |
| 40 samtidiga, olika IPv4 | 8×401 + 32×429 (Retry-After 1). **Peak 4 samtidiga KDF.** Därefter 6 sekventiella korrekta login = 200, running = 0. |
| KDF kastar fel (korrupt hash med giltigt prefix) | 5×500 `{"error":"Ett fel inträffade"}`, sedan limiterns 429. `threw` = 5 och running = 0. Därefter 6× korrekta login = 200, så **platsen frigörs**. Loggen visar bara `BOOKING_INTERNAL_ERROR`. Se E04-QA-3. |

### 4.7 CLI-hemligheter — PASS

- **Linux-pty** (python `pty.fork`, `TERM=xterm`). Transkriptet är `"Lösenord (visas inte): \r\nUpprepa lösenord: \r\nADMIN_COMMAND_OK\r\n"`. **Inget eko.**
- **ps och /proc/<pid>/cmdline** när CLI:t väntar på prompten: `node --env-file=.env --import tsx scripts/admin.mts create <email>`, alltså inget lösenord.
- `historySize: 0`, och readline skriver till en muted stream.
- Dokumentationen säger att lösenord aldrig ska ligga i kommandoraden, `.env`, Git eller rapporter.

### 4.8 Främmande verksamhet / IDOR (E04-6) — PASS

Jag lade in syntetiska rader för `businessId='other'`: tjänst, kampanj, bokning, och ett AdminUser med giltig hash.

- **Login av other-kontot:** 401 med samma body, eftersom en dummy-KDF körs.
- **Som demo-admin A:**
  - `/admin` visar varken other-kampanjen eller other-bokningen.
  - Publish av other-kampanjens id ger **400 "Utkastet finns inte"**, och DB:n har kvar `published=f`.
  - Publish utan cookie ger 403.
- Publika `availability` och `bookings` för other-tjänsten ger "Tjänsten finns inte".
- `businessId` i login-body nekas av det strikta schemat (401).
- Det finns inga server actions att angripa.

Detta är som planen säger ingen full tenant-isolering, bara den uttalade negativa kontrollen.

### 4.9 Läckor — PASS

- **Serverloggar** (auth- och limit-prober): inga lösenord, kanariesträng, `$argon2id`, hashsalt eller råtoken. Bara `BOOKING_SERVER_READY` och `BOOKING_INTERNAL_ERROR`.
- **HTTP-svar:** bara statiska texter.
- **`.next`:** saknar både `SESSION_SECRET`-värdet och kanariesträngen. argon2 finns inte i `.next/static` (klientbundlen).
- **DB:** lösenord bara som PHC-hash, sessioner bara som SHA-256.

## 5. Uppgradering 3→4 — PASS

1. 18a4d73-trädet (Prisma 7, 3 migrationer) migrerades till en ny databas, `booking_e4up_test`, och seedades.
2. Den gamla 18a4d73-prodservern startades på 3311 med syntetiskt `ADMIN_PASSWORD`. Den skapade en riktig legacy-cookie (200, `/admin` visade Administration) och 3 webbokningar (2026-11-16/17/18 09:00 CET). Jag lade också in en kampanj `qa-up-camp`.
3. Servern stoppades. Den nya trädets `prisma migrate deploy` körde bara `20261112030000_individual_admin`. Status: "Database schema is up to date!"

Utfall:

- **Bokningar:** id, starts/ends, e-post och idempotensnyckel är **byte-identiska** före och efter.
- **Kampanj:** intakt.
- **Legacy-session:** raden finns kvar med `userId` NULL. 0 AdminUser, så inga automatiska admins.
- **Ny server (samma SESSION_SECRET):**
  - Legacy-cookien har giltigt format men ger **ej inloggad**, och publish ger **403**.
  - Password-only-login ger 401.
  - **CLI-skapad admin** loggar in (200), ser de uppgraderade bokningarna och kampanjen, och kan publicera `qa-up-camp` (200, `published=t`).
  - Efter höjning till `ADMIN_SESSION_VERSION=2` nekas den nya cookien. Ny login ger 200.
- **Exclusion:** en direkt överlappande insert gav `23P01 booking_no_overlap`.

## 6. Bevarade funktioner — PASS

| Område | Resultat |
|---|---|
| MCP stdio (prob q1, 3419973) | Det publicerade `create_booking`-schemat är **identiskt med 18a4d73**. 22/22 ogiltiga SDK-fall gav isError och exakt "Kontrollera uppgifterna", 0 rader. Positiv kontroll bokade OK. Stderr tom. Råa JSON-RPC-undantag är oförändrade: kända E02-QA-4 (eget `__proto__` tappas) och E02-QA-5 (icke-objekt `arguments` → SDK −32602). Ingen regression. |
| Blandad webb+MCP (10 varv, 10+10 överlappande) | Exakt **en vinnare per varv** (webb 9, MCP 1). **0 överlapp, 0×500**, 0 dåliga varv. Max 321 ms per varv. |
| Idempotens över kanaler | Nyckel K i MCP och sedan i webben med samma payload ger samma id (201). Samma nyckel med annan payload ger **409** "Bokningsnyckeln har redan använts med andra uppgifter." Omvänd ordning (webb först) ger samma id. |
| Kampanj | Publiceringsflödet MCP-utkast → publish är grönt i E2E. Publish efter uppgraderingen fungerar (§5). |
| Exclusion constraint | 23P01 (§5). Matrisens överlappsaggregat är 0. |

## 7. Fynd

| ID | Allvar | Klass | Kort |
|---|---|---|---|
| E04-QA-1 | Medium | IDEA (pilotblockerare; inte blockerare för lokal POC) | 429 från KDF-taket förbrukar den legitima klientens 5-försökskvot, så den låses ute i 15 min |
| E04-QA-2 | Low | Känd pilotblockerare | Ingen kvot per konto: 300 IPv4-adresser ger 300 verifieringar |
| E04-QA-3 | Info | IDEA | Korrupt lagrad hash ger 500 i stället för 401 |
| E04-QA-4 | Info | Distributionsgrind (känd) | Linux-nativepaketet saknar LICENSE-fil; statiskt länkade crates |
| E04-QA-5 | Info | Notering | Playwright hårdkodar `localhost:3000` |
| E03-QA-1, E02-QA-4/5, audit 7 moderate | — | Kända, återobserverade | Oförändrade |

**E04-QA-1: lockout-förstärkning via KDF-mättnad.**

- **Repro** (`probes/p-limit2.mjs`, prod, `TRUST_PROXY_IP=1`):
  1. 40 samtidiga felaktiga login från `10.50.<w>.1–40` håller de fyra KDF-platserna fulla.
  2. 5 ms in i varje våg loggar den legitima klienten `198.51.100.30` in med **rätt** lösenord. Svaret är `429`, `Retry-After: 1`.
  3. Efter fem sådana vågor (~4 s) är floden slut. Ett nytt korrekt försök från samma klient ger då **429, `Retry-After: 898`**, utan KDF.
  4. En annan klient ger 200.
- **Orsak:** `checkLoginAttempt` reserverar per-klientplatsen, och sedan kastar `passwordSlot` `DomainError(429)` när `running>=4`. Reservationen lämnas inte tillbaka (bara lyckad login gör `count--`), så ett kapacitetsavslag räknas som ett misslyckat lösenordsförsök.
- **Påverkan:**
  - En angripare med ≥5 klientidentiteter (IPv4 eller olika /64) kan låsa ut en specifik legitim klient i 15 minuter, även efter att floden upphört.
  - `Retry-After: 1` är missvisande.
  - Själva KDF-mättnaden (kortvarig 429 under pågående flod) är dokumenterad. Förstärkningen till 15 min är det inte.
  - Inte global, och kriteriet "annan klient kan logga in" håller.
  - Lokal POC (127.0.0.1) påverkas inte i praktiken.
- **Fixriktning:** återlämna per-klientreservationen när avslaget beror på KDF-kapacitet (ingen verifiering utfördes, så det ger ingen gissningsfördel). Alternativt: kontrollera kapaciteten före reservationen. Lägg till ett test: N kapacitetsavslag följda av korrekt login från samma klient ska ge 200.

**E04-QA-2: ingen kvot per konto.** 300 gissningar mot samma konto från 300 olika IPv4-adresser gav 300 verifieringar (401). Det enda som bromsar är 4 samtidiga KDF per process, ungefär 14 ms vardera. Planens kriterium gäller per klient och håller, och /64-grupperingen fungerar. Distribuerat missbruksskydd är redan en uttalad pilotblockerare. Lägg till en kvot per konto (med försiktighet mot riktad lockout) och MFA före pilot.

**E04-QA-3:** Ett konto vars `passwordHash` har giltigt prefix men korrupt innehåll ger 500 "Ett fel inträffade" i stället för generiskt 401. Det skiljer sig alltså från ett fel lösenord. Det kräver DB-manipulation, KDF-platsen frigörs och inga detaljer läcker. Idé: mappa verifierfel till 401 och logga en statisk kod.

**E04-QA-4:** `@node-rs/argon2-linux-x64-gnu` 2.2.2 innehåller bara README, package.json och `argon2.linux-x64-gnu.node`, ingen LICENSE-fil. Binären länkar Rust-crates statiskt (bland annat argon2 1.1.0, napi 3.12.1, rand 0.10.2). Inget hinder för lokal POC. Bekräftar Codex distributionsgrind: inventera alla crates och notiser innan någon distribution.

**E04-QA-5:** `playwright.config.ts` använder `baseURL`/`url` `http://localhost:3000`. Det gick bra i den isolerade boxen, men E2E kan inte köras parallellt med något annat på 3000.

## 8. Ej kört / begränsningar

- GitHub CI för 3419973: **NOT RUN** (inget pushat, se resonemanget i §1).
- Windows-TTY: **NOT RUN** (bara Linux-pty).
- Demo vid 9282cdc: **NOT RUN** (ingen demo enligt uppdraget).
- KDF-räkningen bygger på en harness-hook och kan inte se anrop som eventuellt sker utanför `@node-rs/argon2`. Det finns inga andra hashvägar i koden.
- Timing mättes lokalt utan nätverksjitter. Det är en grov jämförelse, inte ett formellt sidokanalsbevis.

## 9. Bedömning

- **Lokal POC: GO.** Inga blockerande defekter, så ingen FIX-REQUEST. E04-QA-1 rekommenderas som en liten rättning i ett eventuellt fixvarv men blockerar inte.
- **Pilot: NO-GO**, oförändrat: MFA, GDPR-livscykel, TLS/proxy i drift, distribuerat/flerinstans-missbruksskydd (E04-QA-1/2) och native-licensinventering (E04-QA-4).

## 10. Städning

- Webbservrarna på 3310/3311 och Playwright-servrarna på 3000 är stoppade.
- PostgreSQL 55541 är stoppad (`pg_ctl stop -m fast`). Inga kvarvarande processer, alla portar stängda.
- Data finns bara i min egen databaskatalog `run-3419973/pgdata`. Inget på PC:n och inga commits.
