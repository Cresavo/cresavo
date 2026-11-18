# QA: separat syntetisk kundkanal, salon 721d445 (gateway f9b8506)

**Start:** 2026-11-16 11:03:02 CET (Europe/Stockholm) · **Slut:** 2026-11-16 11:26:32 CET (Europe/Stockholm) · **Utförd av:** Grok Bot (shell, egen Chromium, egna REST-/MCP SDK-klienter; ingen modellklient)

## 1. Scope
Endast diffen 64b7bcb..721d445: kundkanalen `separate-lab` (leveranshemlighet, mottagare, bindning, migration, fail-closed, OpenAPI, lint-ignore, beroenden). Gatewayen (f9b8506) och tidigare epics har inte granskats om. **Det här är inte riktig kundidentifiering.** Kunden är en fast syntetisk fixtur och "kanalen" är en lokal fil som operatören läser.

## 2. SHA-/bundle-verifiering
- salon-bundlen (transkriberad från uppdraget): 18079 B, sha256 `99f09c8c9f1fe9b92e2365f3f9612b1c02f72c0ef5652507f28e5fe3f3629d9d` ✔. `git bundle verify` ok; den kräver 64b7bcbc; ref `feat/separate-customer-consent-lab` = 721d445b651f… ✔. Notera att base64-strängen i uppdraget slutar på `…Vmzg==`, inte `CnlenDg==` som angavs. Bytesen matchar ändå sha256 exakt.
- Kopian är hämtad read-only och push-URL:en är `DISABLED`. HEAD 721d445 är detached och `git status` är ren efteråt (0 rader) i båda kopiorna.
- `git ls-remote` (read-only): `feat/separate-customer-consent-lab` = 721d445 och `proof/customer-approval-boundary` = 64b7bcbc.
- Gatewayen återanvänder `night-f9b8506-0a88ac2/bundles/gateway.bundle` (sha `2170a0e9…`), HEAD f9b8506.
- Diff: 17 filer, +516/−25. `package.json`/`package-lock.json` har **ingen diff**.

## 3. Miljö och kommandon
`unshare -rn` → userns uid 1000 med endast `lo`, `codex` finns inte på PATH, `TZ=Europe/Stockholm`, `env -u NODE_ENV`. Embedded pg körs på 127.0.0.1:56385 och varje steg får en färsk `*_test`-DB (19 migrationer). SESSION_SECRET och tjänstetoken är syntetiska och finns bara i processmiljön. `npm ci` och `npm audit` kördes utanför netns.
Kedja (`ns.sh`, sha `93124f9b…`): `prisma generate` → `npm test` (RATE_LIMIT_STORE=memory) → `npm run lint` → `tsc --noEmit` → `npm run build` → `npx vitest run --config vitest.integration.config.ts` (RATE_LIMIT_STORE=postgres) → `npm run test:pair` (GATEWAY_PATH=f9b8506) → `node --import tsx qa-probe/channel-probe.mts`.
Egen probe: `separate-channel-721d445/probes/channel-probe.mts`, sha256 `a17a421719d63d4e9938aa68aeb764319a42b6436820774fe76da878814c2856`. Loggar finns i `separate-channel-721d445/logs/`.

## 4. Resultat
| Steg | Utfall |
|---|---|
| prisma generate / migrate (19) / seed | rc 0 |
| Migrationskontroll (psql) | båda CHECK finns, `consentDelivery` nullable=YES |
| Unit | rc 0, **44 filer / 423 tester PASS** (7 s) |
| Lint / tsc / build | rc 0 / rc 0 / rc 0 |
| Integration (hela) | rc 0, **38 filer / 211 tester PASS** (73 s) |
| `npm run test:pair` (ordinarie) | rc 0, **19 PASS**, `dirty=false`, salon 721d445 + gw f9b8506 |
| Egen probe | **31/33 PASS, 2 FAIL** (g1-bokningsdelen och e2-bokning: 429, se SC-QA-1) |
| Läckage-scan av egna loggar | 0 träffar (17 mönster), SESSION_SECRET 0 |
| `npm audit` | alla: 7 moderate · `--omit=dev`: 0 |

Probefall, alla via gateway 3218 → salon 3217 i split-läge:
- **(a)** REST- och MCP-`create_proposal`/`get_proposal`: djupscan ren (ingen token, `consent/`, e-post, namn, inbox-sökväg, approvalUrl eller 43-teckens sträng). Inget approve-, consent- eller inbox-verktyg bland 12 MCP-verktyg. Kvittot har läge 0600, subject = serverns fixtur och länk-origin = salong. **PASS**
- **(b)** Rätt token i `Authorization`/`x-api-key`, 5 gissningar och nyckel som token gav 403 och 0 mandat. Bokning utan mandat gav 400 `mandate_required`. **PASS**
- **(c) [EGEN CHROMIUM]** Färsk kontext med 0 cookies. Sidan utan token visar ingen Ja-knapp. Kvittolänken godkänner → 1 mandat, `separate-lab-v1`/`customer-consent`. Bokningen gav 201 och retry gav 200 med samma id, `replayed`, 1 rad. **PASS**
- **(c) [EGEN RÅ HTTP]** MCP-skapat förslag godkänt med token från kvittot (view→yes): samma utfall, 201/200/1 rad. **PASS**
- **(d)** Annan e-post, annat namn eller e-post med ändrad versalisering → 403 med 0 rader. Främmande klient → 404/403. Klient-JSON som väljer `consentDelivery`/`approvalDelivery`/`customer` → 400 utan länk. Ändrad JSON, fel hash, annat förslags token eller använd länk → 403 med 0 extra mandat. Fixturen bokar fortfarande. **PASS**
- **m1** DB CHECK med ogiltig `consentDelivery`, separate+smsOtp, `separate-lab-v1` med annan origin och ogiltig `verifiedVia` → `check_violation` ×4. **PASS**
- **(e1)** En legacy-länk som skapades före separate-lab ger 403 på view/yes och 0 mandat. **PASS**
- **(e2)** Ett separate-lab-förslag som godkänns efter omstart utan separate-lab behåller `separate-lab-v1`, och annan kontakt ger 403. **PASS**. Bokning med fixturen gav 429 → **FAIL** (SC-QA-1).
- **(f)** Utanför tmpdir, symlänk, OTP+separate, `VERCEL_URL`, saknad env, relativ sökväg, 0750 och okänt värde → 403/400 via både REST och MCP, ingen länk i något svar och 0 rader. `VERCEL=1` gör att servern inte startar (fail-closed). Mapp med 0500 (ej skrivbar) → 503 `provider_unavailable`, inget kvitto, men 2 pending-rader (SC-QA-3). **PASS**
- **(g)** Default legacy: approvalUrl returneras, `consentDelivery` null och `verifiedVia` null ✔. Bokningen gav 429 → **FAIL** (SC-QA-1). Legacy-bokning täcks annars av gröna integrations-/pair-tester.
- **Städning:** probens förslag, mandat, bokningar och nycklar = 0. DB-räkning efter varje steg = 0. Inga `booking-consent-inbox-*` kvar.

## 5. Fynd
**SC-QA-1 · Låg (backlog) · Fast fixturkontakt delar dagsgränsen 3 bokningar per e-post**
- Var: `src/lib/agent-api/customer-channel-lab.ts:10-12,59-62` tillsammans med den befintliga gränsen i `src/lib/domain.ts:347-364` (`count >= 3` per e-post och dag) och klientgränsen 5/dag (`domain.ts:335-345`).
- Repro: probens bokningar nr 4 och 5 samma dag med `separate-customer@example.test` gav 429 (`logs/probe-3-salon-legacy.log`).
- Följd: alla klienter i separate-lab delar 3 bokningar per dag och företag. Gränsen fungerar fail-closed. Det är inte en regression i 721d445, men det gör att labbet slår i taket snabbt. Mina två FAIL beror på probens design (för många bokningar med samma kontakt), inte på kanalbindningen. Jag har inte kört om dem.
- Minsta fix: dokumentera gränsen eller låta labbet använda per-körning-fixtur (t.ex. `separate-customer+<run>@example.test`, bunden i raden).

**SC-QA-2 · Låg (backlog) · Kvittofilens skydd bygger på samma uid och kontrollen görs före skrivningen**
- Var: `customer-channel-lab.ts:30-36` (kontroll i `prepareCustomerDelivery`, som anropas före tx på `proposals.ts:39`) och `:44-47` (skrivning efter commit på `proposals.ts:79`).
- Konsekvenser:
  - Ingen ägar-uid-kontroll.
  - Mellanliggande komponenter öppnas utan O_NOFOLLOW.
  - Prefixmatchningen godtar även undermappar (`…/booking-consent-inbox-x/y`).
  - Servern raderar aldrig kvitton; operatören måste göra det.
- Följd: en process med samma uid (t.ex. en agent-CLI med filverktyg eller läsbar sandbox) kan läsa länken. Separationen från agenten förutsätter att klienten saknar filåtkomst. `wx` och 0600 hindrar överskrivning och läsning från andra uid. TOCTOU kräver samma uid.
- Minsta fix: kontrollera `stat.uid === process.getuid()`, kontrollera om (eller öppna via fd) vid `send`, kräva att `dirname(path) === root` och dokumentera radering.

**SC-QA-3 · Låg (backlog) · Misslyckad leverans efter commit lämnar pending-förslag**
- Var: `proposals.ts:70-80` och `customer-channel-lab.ts:48`.
- Repro: f9 (0500) gav 503 och +2 rader utan kvitto.
- Följd: förslag som ingen kan godkänna ligger kvar tills TTL löper ut. Ingen hemlighet läcker.
- Minsta fix: markera förslaget som `expired`/`failed` i catch, eller skriva kvittot före commit.

**SC-QA-4 · Info · OpenAPI**
- Var: `docs/agent-api-v1.openapi.yaml:57-66`.
- `GET /api/v1/proposals/{id}` saknar 429/500, som POST har. I övrigt gäller: `approvalUrl` endast i legacy, `approvalDelivery` som const, strikt schema.

**Utan anmärkning:**
- Mottagaren väljs av servern (`customer-channel-lab.ts:10-12,45`). Klient-JSON avvisas (strikt schema, d3).
- Bindningen är radbaserad och överlever config-ändring och nedgradering (`proposals.ts:109-110,152`). Den gäller både native (`bookings.ts` ~170-176) och partner (`partner-bookings.ts:52`).
- Migrationen ligger i BEGIN/COMMIT, kolumnen är nullable, CHECK:arna är kompatibla med befintliga rader och testades live (m1).
- Klienten har ingen läs- eller godkännanderätt: decision-routen avvisar auth-headers (b1) och MCP saknar sådana verktyg.
- `eslint.config.mjs:7` `test-results/**`: 0 spårade filer under `test-results`, så inga underhållna filer döljs.
- `.env.example` har bara fått kommentarer.

## 6. Blockerare kontra backlog
**Blockerare (för syntetisk lokal användning): inga.** Backlog: SC-QA-1, -2, -3, -4. Inför en pilot eller riktiga kunder är kanalen i sig en blockerare: identifieringen är inte riktig, och kanalen är en lokal fil på samma uid.

## 7. Påståenden (Codex/Niclas)
| Påstående | Status |
|---|---|
| 423 unit / 211 integration | **CONFIRMED** (eget: 423/211) |
| lint, tsc, build grönt | **CONFIRMED** (eget) |
| generate, migrate 19, seed exit 0 (ren slutkörning) | **CONFIRMED** för egen körning (19 migrationer); Niclas egen körning UNVERIFIABLE |
| audit 7 moderate dev / 0 prod | **CONFIRMED** (`npm audit` 7 moderate; `--omit=dev` 0) |
| 721d445/f9b8506 på privat origin/feat/separate-customer-consent-lab | **CONFIRMED** för 721d445 (ls-remote). f9b8506 på den grenen är inte kontrollerad (den grenen är salon-repot) |
| Codex: native `test:pair` 24 PASS, samma id i kalendern | UNVERIFIABLE (`--native-codex` ej kört) |
| Niclas: `--native-codex` exit 0, 25 PASS, båda dirty=false (codex-cli 0.153.2, node v24.16.0, 2026-11-16T10:03:47.973Z = 11:03:47 CET) | UNVERIFIABLE |
| Niclas: extra negativt native-webbläsartest utan kunduppgift nekades | UNVERIFIABLE. Eget motsvarande: Chromium utan token visar ingen Ja-knapp och 0 mandat (c1) |
| Niclas: annan @example.test-kontakt → 403 | UNVERIFIABLE för hans körning. **Eget reproducerat** (d1, e2) |
| Niclas: separat godkännande → create/retry/status 1 rad med samma id (proposal 42343d1e…, booking e6c6ba9c…, replayed true) | UNVERIFIABLE för de id:na. Flödet är **eget reproducerat** (c1/c2) |
| Niclas: data och inbox städade, servrar och PG stoppade | UNVERIFIABLE (hans maskin) |
| Niclas: tidigare 423/211/lint/build bevarade | överensstämmer med egna siffror |
| CI 43845636237 pågår | UNVERIFIABLE (CI ej öppnat) → inte GO |

## 8. NOT RUN
`npm run test:pair -- --native-codex`, Codex CLI eller någon annan modellklient eller modellkonto, ChatGPT, CI 43845636237, Docker, Vercel-deploy, riktig SMS och e-post, Windows-ACL (koden hoppar över lägeskontrollen på win32) och en annan uid som försöker läsa inbox. g1-/e2-bokningarna kördes inte om efter 429 (enligt regeln: röda körs inte om).

## 9. Verdikt (avgränsat)
**GO endast för syntetisk lokal labbanvändning** av 721d445 + f9b8506: kanalen håller länken borta från agentsvar, binder kontakten i raden och är fail-closed vid felkonfiguration. **Inget pilot-GO**, CI är oavslutat och **det här är inte riktig kundidentifiering**.

## 10. Städning
Egna servrar (3217/3218) och pg 56385 är stoppade och portarna lediga. Följande är borttaget: inbox-mappar, `/tmp/scns`, hemlighetsfilen (shred), node_modules, `.next` och `test-results`. Inga andra processer har rörts.
