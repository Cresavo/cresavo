# Projektstatus – Booking Lab SE

## Aktuell status: Epic 01 QA batch 2

Verifierat 2026-11-11, kod **a84e48a32a874a4392c13bb4f32437d06b317c45**, bas b000481 på epic-01-foundation-hardening. Punkterna 1–5 och 7–11 levererade, punkt 6 undantagen. Ingen Epic 02, push eller ändrad synlighet. Lokala commits ligger före GitHub-versionen.

| Funktion / acceptanskriterium | Tekniskt och automatiskt testat | Prova / UX / kundklarhet |
|---|---|---|
| Fem fel från A spärrar inte korrekt lösenord; 30 bokningsförsök från A spärrar inte B | PASS, riktiga sockets i direkt/proxyläge | Lokalt API/tester. IP/NAT delar fortfarande tak; inte kundklar. |
| Förfalskad IP från olistad proxy nekas; full Map blockerar inte nya klienter | PASS E2E/unit, startup utan proxylista nekas | Konfigurationsskydd; verklig driftsproxy/TLS återstår. |
| Max fem nya bokningar/klient/dag och tre/e-postnyckel inklusive +taggar | PASS, sex samtidiga försök ger fem bokningar | Syntetisk demo/API; inte verifierad identitet. |
| Kopierad cookie nekas efter logout; global versionsåterkallelse består | PASS E2E/unit | Logga ut i sidhuvudet. Delad identitet och ingen sessionsgallring. |
| Ogiltiga datumfilter ger 200, svensk text och standardintervall | PASS E2E/unit | Kan provas i /admin. Agenda, inte full kalender. |
| Kundretry/dubbelsubmit ger samma ID och en rad; replays förbrukar ingen budget | PASS HTTP/UI/integration | UUID hålls i formulärminnet, inte över sidomladdning. |
| Kampanjfel skiljer omvända datum från för lång giltighet | PASS unit, tidigare campaign-integration kvar | 100 % tillåts som information; ingen debitering. |
| MCP följer exporterad databas trots annan env-fil; cleanup efter timeout | PASS integration och separat faktisk timeout-process | Lokal stdio och syntetisk DB. Ingen fjärr-MCP. |
| YYYY-MM-DD och logout i header, utan N-badge | PASS produktionsdemo + två visuellt granskade bilder | Kan provas; textdatum saknar native kalenderpopup. |

Sammanfattad verifiering: **20 unit, 16 integration, 8 E2E i vardera av fyra lägen**, lint/tsc/build PASS. Produktionsdemo 2/2 PASS. Audit FAIL: 3 höga + 7 måttliga. [Faktiska kommandon, tidigare fel och ej körda kontroller](VERIFICATION.md).

## Kvarstående och planerat

- Punkt 6 (Visa e-post) är inte implementerad enligt beslut. Adminmaskering och minimerat MCP-svar består.
- Individuella administratörer, datalivscykel/GDPR, sessionsgallring, auditåtgärder och verifierad drift saknas. Ingen funktion är godkänd för riktiga kunder.
- Processlokala räknare, NAT-delade tak, obegränsad kampanjlista och CSP unsafe-inline kvarstår. Flerföretagsisolering är inte verifierad.
- Docker/PG16, extern CI och verklig TLS/proxy har inte körts/verifierats i denna batch. Repo är privat och ändringarna är inte pushade.

## Förändrat och demo

Den globala bucketen och blinda header-tilliten har ersatts med verifierad socketgräns. Logout återkallar serverraden. UI-retry, säkra filterfel, tydliga datum och tillförlitligare teststädning finns nu. Ingen ny dependency; gamla migrationer och exclusion constraint är oförändrade. Ny migration tillför sessioner och bokningsnycklar för dagstak.

[Ny produktionsdemo](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html), [manifest](../demo-artifacts/2026-11-11T21-04-56-806Z/manifest.json): a84e48a, dirty=false, 12 bilder/2 videor. Bilder är visuellt granskade; videometadata kontrollerade, inte full genomtittning. Artefakter är lokala, inte åtkomliga via Git. Prova enligt [DEMO](DEMO.md).

Tre nästa mål: (1) oberoende QA av denna revision och därefter godkänd delning till privat repo, (2) separat auditåtgärd samt Docker/CI/TLS-proxy-verifiering, (3) individuella adminidentiteter och beslutad/testad datalivscykel före pilot. Inget av detta är påbörjat som Epic 02.

## Historik före QA batch 2

Senaste kodrevision: `3b3309d` (endast återstående formatering efter funktionellt testade `26ea617`); lint/tsc/build/Prettier omkörda PASS.

Verifierat 2026-11-11, kodrevision `26ea6171de05fe17ce4d8bd1e4a4d931d9d5bc82`, branch `epic-01-foundation-hardening`, bas `ed1658a`. Denna leverans är **Epic 01 QA fix batch**, ingen ny Epic. Faktiska kommandon, fel och ej körda kontroller: [VERIFICATION](VERIFICATION.md).

## Fungerar och är automatiskt testat

| Funktion och acceptanskriterium | Tekniskt/testat | Kan provas? | UX / riktiga kunder |
|---|---|---|---|
| Kund bokar ledig tjänst; bekräftelse innehåller tjänst och Stockholmstid | PASS unit/integration/E2E | Ja, lokal demo | POC; native datumformat och nätverksfel behöver förbättras. Inte kundklar. |
| Samtidighet: 20 försök, exakt en bokning per konfliktfönster, noll SQL-överlapp | PASS riktig PostgreSQL | Via automatiska tester | Ingen belastnings-/flerprocessdrift verifierad. |
| Retry: samma nyckel/payload ger samma 201/ID även 20 parallellt; annan payload 409 | PASS domän och HTTP | API med Idempotency-Key | Nyckel är valfri; UI genererar ännu ingen retry-nyckel. |
| Admin: datumfilter, max 100/sida, maskerad e-post; 150 poster ger100 + 50 | PASS integration/E2E | Ja, /admin | Agenda, inte full kalender; felaktigt URL-filter ger generiskt fel. Delad identitet. |
| Logout tar bort browseråtkomst; versionshöjning ogiltigförklarar gamla cookies | PASS E2E/unit | Ja, Logga ut / lokal konfiguration | Global återkallelse, inga individuella serversessioner. |
| Missbruk: sjätte felaktiga login ger 429; max 3 skapade bokningar/e-post/Stockholmsdag | PASS unit/integration/HTTP | API/testsvit | Processlokal IP-gräns; proxykonfiguration krävs före drift. |
| MCP: avgränsade läsningar och strikt kampanjutkast, utan kundnamn/e-post | PASS stdio-integration/E2E | Ja, lokal testklient | Betrodd lokal --admin, ingen publik fjärråtkomst. |
| Kampanj publiceras manuellt och visas bara under giltiga datum, max 90 dagar | PASS integration/produktionsdemo | Ja, MCP + admin | Informationspris, ingen debitering. |
| Headers, no-store admin, testdatabasgrind | PASS E2E/unit, HSTS i produktionsdemo | Testkommandon | CSP unsafe-inline, verklig TLS/proxy ej verifierad. |

Inga ovanstående funktioner är godkända för riktiga kunduppgifter. **14 unit + 14 integration + 6 E2E PASS**, lint/tsc/build PASS; demo 2/2 PASS. Audit FAIL: 3 höga + 7 måttliga.

## Delvis implementerat och blockerare

- Lokal missbruksspärr och global sessionsversion finns; individuella konton, individuell återkallelse och robust driftgräns saknas.
- Bokningslista är avgränsad; kampanjlistan är fortsatt obegränsad. Pagineringen är inte en fryst snapshot.
- Testad Windows/PostgreSQL18.6/Chromium. Docker/PostgreSQL16 och faktisk GitHub-CI inte körda.
- Kvarvarande audit, binära tredjepartsnotiser/källkodserbjudande, TLS, loggar, backup/restore, gallring, rättslig grund och mottagare måste hanteras före kunddrift.
- Ingen verifierad flerföretagsisolering. Ingen fullständig extern trafik-/leverantörsgranskning.

## Förändrat sedan föregående arbetsomgång

QA-fynd 1–13 hanterade med rate limit, dagstak, logout/version, avgränsad lista, idempotensmigration, headers, test-DB-grind, strukturerad konfliktmappning, samtidighetstester, kampanjregler, bekräftelse/prisformat och produktionsdemo. Enradiga filer formaterade, audit separerat i CI, licensnotiser och separat Prisma 7-plan tillagda. Inga nya npm-beroenden, ingen major-uppgradering; gammal migration/exclusion constraint bevarad.

## Prova nu

Följ [DEMO](DEMO.md). [Nytt galleri med tolv bilder och två videor](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html), [manifest](../demo-artifacts/2026-11-11T19-51-02-683Z/manifest.json). Inspelat mot produktionsbygge, bas ed1658a med arbetsändringarna som sedan blev 26ea617. Artefakter är lokala/ignorerade, inte del av Git.

## Tre rekommenderade nästa mål (inte påbörjade)

1. Oberoende QA av denna commit och verifiering på Docker/PostgreSQL16/CI; hantera audit i separat beroendeförändring enligt Prisma 7-planen.
2. Före pilot: individuell adminidentitet/återkallelse och verifierad TLS/proxy-/missbruksgräns.
3. Syntetisk driftövning för backup/restore, loggminimering, gallring och dataskyddsansvar; tenant-isolering före delad flerföretagsdrift.
