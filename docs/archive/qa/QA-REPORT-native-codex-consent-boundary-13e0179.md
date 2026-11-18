# QA-ADDENDUM: kundgodkännandets identitetsgräns, salong 13e0179

Tillägg till QA-REPORT-native-codex-6aed511.md. Start 2026-11-16 09:47 CET, slut 2026-11-16 09:52 CET (Europe/Stockholm, UTC+1). Körmapp: /workspace/qa/booking-lab-se/consent-identity-13e0179/

## Omfattning
Avgränsad återkontroll (t126u) av kundgodkännandets identitetsgräns på fryst salong 13e0179 + oförändrad gateway f9b8506. Ingen full QA, ingen gatewaygranskning, ingen native-klient. Tillägg till QA-REPORT-native-codex-6aed511.md (orörd, sha256 25843111f82f12e3c2be4b0e06ba346c1cbb973411f3508cc470a3e4c2e3427a). Alla prov är egna, med rå HTTP, MCP-SDK-testklient och headless Chromium. Ingen AI-modell eller verklig assistent har använts.

## SHA och diff
- Privata origin/proof/native-codex-consent hämtat läsande till ny kopia (push DISABLED) = 13e01799427e9fa7e8617479cc6e61941a528d07; detached HEAD 13e0179.
- git log 6aed511..13e0179: 13e0179 docs: record native client proof, independent QA and green CI.
- git diff --stat 6aed511..13e0179 (6 filer, +298/−1): .gitattributes, AGENTS.md, docs/HANDOFF.md, docs/PROJECT_STATUS.md, docs/VERIFICATION.md, docs/qa/QA-REPORT-native-codex-6aed511.md (byte-identisk med min rapport, samma sha256). Diff mot src/, prisma/, package.json, package-lock.json: TOM. Därför kördes inte full svit/lint/build-gate.
- Gateway: bundle night-f9b8506-0a88ac2/bundles/gateway.bundle (sha256 2170a0e9…) verify okay, HEAD f9b8506.

## Kodcitat (13e0179)
- deliver lämnar länken till anroparen: src/lib/agent-api/customer-identity.ts:23–24 (kommentar: labbet lämnar avsiktligt bearerlänken till anroparen), 29–32 (approvalUrl = origin/consent/id#token); src/lib/agent-api/proposals.ts:74 returnerar den i create_proposal-svaret (REST och MCP, mcp.ts:40–41).
- Decision-routen nekar auth: src/app/consent/[id]/decision/route.ts:8–12 (authorization eller x-api-key ger 403, liksom fel Origin, fel content-type och icke-loopback).
- Tokenkontroll: proposals.ts:82–86 (strikt schema, 43 tecken), :95 (SELECT … tokenHash = sha256 FOR UPDATE), :99–100 (måste vara pending och ha oförändrad proposalHash), :103 (utgång); customer-identity.ts:34–35. Token bevisar bara innehav av länken, inte identitet.
- OTP: sms-otp.ts:6–10 (aktiv endast med BOOKING_SMS_OTP_LAB=1, verksamhet i listan och consent-lab); :11–15 syntheticPhone kontrollerar bara format; proposals.ts:21, 37–39 customerPhone kommer från klienten; :69–70 send; :124–133 kodverifiering (6 siffror, hash, max 5 försök, TTL); :140 verifiedVia blir sms-otp endast med OTP, annars null.
- SmsSender: sms-otp.ts:33–44 är en processlokal minnesbuffert i SimulatedSmsSender (max 1000), utan HTTP/MCP-export och utan riktig SMS.
- Labbgrind: customer-identity.ts:12–22 (requireConsentLab: BOOKING_CONSENT_LAB=1, inte vercel, loopback-origin, test-DB); route.ts:7; proposals.ts:88; sms-otp.ts:8, 36, 40.

## Körning
Isolering: unshare -rn (endast lo) och userns uid 1000. Embedded Postgres på 127.0.0.1:56375 med färska ci_unit_test, ci_int_test och ci_probe_test. TZ=Europe/Stockholm, utan NODE_ENV. Syntetisk SESSION_SECRET och tjänstetoken låg endast i processmiljön. ~/.local/bin (codex) var borttaget ur PATH och CODEX_HOME avsatt; codex_in_PATH=none. Servrar startades med setsid (detached) och utdata till filer. npm ci kördes utanför netns. Allt kördes sekventiellt, en gång, utan omkörning.

| Steg | Resultat |
|---|---|
| prisma generate, migrate (18), seed på färska DB:er | PASS, 0 agentrader efter seed |
| Unit: agent-mandate, customer-consent-flow, customer-consent, sms-otp, native-proof-events | PASS 83/83, 5 filer (77 utan de 6 native-testerna) |
| Integration: customer-consent, sms-otp, agent-usp, agent-bookings, agent-audit, mock-partner-gateway | PASS 41/41, 6 filer |
| npm run build (krävs för att starta servern, ingen gate) | rc=0 |
| Eget prov identity-probe.mts | 20/20 PASS (19 kontroller + städning), känsliga träffar i loggar 0 |

Eget prov: probes/identity-probe.mts, sha256 932141ecc92e6b92447d82b624070625cef5fb9ec6a4f1e13abee9f61e0cecde. Kopierades tillfälligt till salon/qa-probe och togs bort efteråt. Det startar salong (split, consent-lab) och gateway via setsid. Niclas probe (039c70c0…) kördes inte.

Utfall per kontroll:
1. Nekande, PASS. MCP-verktygslistan (12) saknar approve/consent/mandate/decision. create_proposal via MCP returnerar approvalUrl med 43 tecken långt fragment till agenten. Bokning utan mandat ger 400 mandate_required. Decision med Authorization, med x-api-key och med fel token ger alla 403 och 0 mandat.
2. Länkinnehavare godkänner. Med rå HTTP utan auth och med agentens returnerade token: view och sedan yes ger 200. Förslaget blev approved med mandat origin=customer-consent och verifiedVia=null. Gatewaybokning gav 201, retry samma nyckel 200 med samma id och replayed, och 1 rad. Använd länk gav 403, och återanvänt mandat med ny nyckel 403 mandate_denied. I färsk headless Chromium (nytt kontext, 0 cookies, ingen inloggning, viewport 390) med länken från MCP-svaret: klick på Ja gav approved, customer-consent, verifiedVia=null, och därefter 201/200 samma id med 1 rad. Främmande klient: förslag 404, mandatanvändning 403. 20 samtidiga yes gav 1×200, 19×403 och 1 mandat. Utgången länk 403 med 0 mandat. Ändrad JSON, främmande länktoken och fel proposalHash gav 403 med 0 mandat. Återkallat mandat gav 403 mandate_denied.
3. OTP-labb (BOOKING_SMS_OTP_LAB=1, BOOKING_SMS_OTP_BUSINESSES=demo): förslag utan customerPhone gav 400. Ett klientvalt syntetiskt nummer accepterades (201). Svaren från create och get_proposal innehöll ingen kod, otpHash eller otp-fält. Giltig länk utan kod, med fel 6-siffrig kod och med ogiltig kod gav 403 och 0 mandat. Rätt kod provades inte, eftersom bufferten är processlokal i servern.
4. Labb av (ingen BOOKING_CONSENT_LAB): förslag 403 mandate_denied; decision yes och view med giltig token 403; 0 mandat.

Städning: proposals, mandat, bokningar och nycklar från provet = 0. Inga kvarvarande processer eller portar. Postgres stoppad; pgdata, node_modules, .next, test-results och /tmp-kataloger raderade, hemlighetsfilen shreddad. SESSION_SECRET i loggar: 0 träffar. Båda git-träden rena.

## NOT RUN
--native-codex, codex eller annan modellklient, ChatGPT; riktig SMS; rätt OTP-kod; utgånget mandat (expiresAt); full unit-/integrationssvit, lint och tsc (diffen saknar src); CI, Docker, Vercel; gatewaygranskning; Niclas probe.

## Påståenden (Niclas t126u)
| Påstående | Status |
|---|---|
| Ingen produktkod ändrad sedan 6aed511 | CONFIRMED (endast docs och .gitattributes) |
| Auth-header och fel token nekas; inget approve-MCP-verktyg | CONFIRMED |
| Agentens returnerade länk i färsk browser (0 cookies, ingen inloggning) godkänner; customer-consent, verifiedVia=null; 201, sedan 200 samma id, 1 rad | CONFIRMED (egen Chromium och rå HTTP) |
| Bokning 99eda0bb-76c0-4e1e-acaa-41ab9e052bb5 | UNVERIFIABLE (min körning har egna id) |
| 20 samtidiga yes ger 1 mandat | CONFIRMED |
| Utgången länk, återkallat mandat, främmande, ändrad, återanvänd nekas | CONFIRMED |
| Utgånget mandat nekas | UNVERIFIABLE (ej kört) |
| OTP: länken ensam räcker inte, ingen kod till agenten | CONFIRMED |
| SmsSender är processlokal simulerad buffert | CONFIRMED (sms-otp.ts:33–44) |
| Telefonnummer väljs av klienten, ej bundet till verifierad avsedd kund | CONFIRMED (proposals.ts:21, 37–39; sms-otp.ts:11–15; prov 3b) |
| Labb av nekar förslag och godkännande | CONFIRMED |
| prisma generate/migrate/seed | CONFIRMED |
| Unit 77/77 | CONFIRMED i antal (83 − 6 native = 77; hans filurval inte känt) |
| Integration 41/41 | CONFIRMED i antal (mitt urval av 6 filer) |
| CI 43820748911 SUCCESS (408/205/64/13) | UNVERIFIABLE |

## Scope och risk
- Mitt tidigare påstående i originalrapporten (”agent kan inte godkänna”, C6/C7) gällde bara de då provade vägarna: agentnyckel i Authorization-header och avsaknad av MCP-verktyg. Samma rapports C7 godkände faktiskt med rå HTTP och länkens token. Påståendet avgränsas härmed: en anropare som håller den returnerade länken kan godkänna utan auth.
- Detta är en avsiktlig och dokumenterad labbegränsning (customer-identity.ts:23–24), inte en regression och inte en publik sårbarhet så länge labbet är av. Med labbet av nekas både förslag och beslut (kontroll 4), och requireConsentLab kräver loopback och test-DB.
- Bedömning: FAIL för oberoende kundidentifiering och för att agenten inte ska kunna självgodkänna. Servern kan inte skilja kunden från en agent med länken. verifiedVia=null utan OTP; med OTP finns ingen bindning till en verifierad avsedd kund eftersom numret är klientvalt och SMS:et simulerat.
- Minsta nästa beslut före pilot: returnera aldrig approvalUrl eller token till anroparen. Leverera länken out-of-band till en kundverifierad kanal (ett kontaktsätt som verksamheten redan har registrerat, inte klientangivet), eller bind godkännandet till en verifierad kundidentitet (inloggning/OTP mot registrerad kontakt). Kräv verifiedVia ≠ null för mandat utanför labbet.

Ingen regression hittades, därför ingen FIX-REQUEST.

## Kommandon
git clone/fetch (läsande, push DISABLED), git log/diff --stat, git bundle verify; npm ci (salon, gateway); i netns via ns.sh: npx prisma generate; npm run db:migrate, npm run db:seed per färsk DB; npx vitest run (5 unit-filer); npx vitest run --config vitest.integration.config.ts (6 filer); npm run build; node --import tsx qa-probe/identity-probe.mts; psql-räkningar; grep efter hemligheter; städning.

## Harnessavvikelser
npm ci kördes utanför netns. Build kördes endast för att kunna starta servern. ls/ip i netns visade endast lo.
