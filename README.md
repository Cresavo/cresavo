# booking-lab-se

## Epic 02 — lokal agentbokning

En betrodd lokal MCP-klient kan nu skapa en syntetisk bokning via samma bokningsmotor som webben. Prova `npm run mcp:client -- --admin --book` efter lokal installation och bekräfta med `ja`; kontrollera sedan bokningen i `/admin`. Verktyget kräver separat opt-in, minimerar svaret och bevarar databasens integritetsregler. Ingen extern AI-modell behövs. [MCP-kontrakt och begränsningar](#lokal-syntetisk-agentbokning-epic-02).

Lokal slutmatris på kod 3cd633b: 43 unit, 30 integration ×3 och 12 E2E i fyra lägen, lint/tsc/build/cleanup PASS. Audit kvar FAIL (3 höga/7 måttliga). Slutdemo 4/4 PASS; oberoende slut-QA pågår. **POC för syntetiska uppgifter, inte pilot**. [Aktuell status](docs/PROJECT_STATUS.md) · [Exakta resultat](docs/VERIFICATION.md) · [Demo](docs/DEMO.md).

## Uppföljning M2/L8 efter fixomgång 3

Samtidiga bokningar för samma anställd/dag serialiseras nu före tillgänglighetskontroll. Databasens överlappsskydd är kvar; lås-/serialiseringskonflikter från insert ger det befintliga svenska konfliktfelet. Proxykonfiguration avvisar även IPv6-subnät som annars skulle lita på IPv4-klienter (exempel ::/32).

CI är konfigurerat för fyra E2E-jobb: dev/production × TRUST_PROXY_IP=0/1. Ny extern CI-körning kräver senare godkänd push. Aktuell testning och undantag finns i [VERIFICATION](docs/VERIFICATION.md). Vanliga fixomgångar kräver ingen ny demo; senaste inspelning är märkt med sin äldre revision.

En liten lokal, svensk boknings-POC för en fiktiv salong. Next.js, TypeScript, PostgreSQL/Prisma och lokal MCP över stdio. Endast syntetiska uppgifter. **Inte för produktion eller riktiga kunder.**

För produktägaren: [projektstatus och acceptanskriterier](docs/PROJECT_STATUS.md), [prova/spela in demo](docs/DEMO.md) och [senaste produktägarrapport](docs/PRODUCT_OWNER_REPORT.md). `npm run demo:record` skapar lokala bilder och video med befintliga Playwright-verktyg; ingen extern publicering.

## Starta lokalt

Förutsättningar: Node.js 22.12 eller senare (alternativt 24 eller senare), npm och Docker med Compose. Port 5432 och 3000 måste vara lediga. I projektkatalogen:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Redigera .env: välj ADMIN_PASSWORD (minst 12 tecken) och SESSION_SECRET (minst 32 slumpmässiga tecken).
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Öppna http://localhost:3000 och välj en vardag inom 60 dagar. Salongen har öppet måndag–fredag 09–17 i Europe/Stockholm, en anställd och tider på halvtimmar. Logga in via `/admin` med lösenordet i `.env`. Seeds kan köras igen utan att radera bokningar. För en egen Postgres-instans, ändra `DATABASE_URL` i `.env`; databasanvändaren måste kunna skapa extensionen `btree_gist`. Ett verifierat alternativ utan Docker beskrivs i [verifieringsrapporten](docs/VERIFICATION.md). Compose-lösenordet är endast avsett för lokal demo. Stoppa databasen med `docker compose stop`; volymen sparas.

## MCP

En betrodd lokal MCP-klient kan starta `node --env-file=.env --import tsx src/mcp/server.ts` i projektkatalogen. Standardläget erbjuder `list_services` och `get_availability`. Administratören kan uttryckligen lägga till argumentet `--admin`; då tillkommer `list_bookings` och `create_campaign_draft`. Ge endast betrodda lokala klienter adminläget: flaggan är en lokal behörighetsgräns, inte säker fjärrautentisering. Servern lyssnar inte på något nätverksuttag. Utkastet publiceras manuellt i administrationen.

Prova med den medföljande klienten:

```powershell
npm run mcp:client
npm run mcp:client -- --admin
```

### Lokal syntetisk agentbokning (Epic 02)

```powershell
npm run mcp:client -- --admin --book
```

Detta separata opt-in-läge visar Fotvård, en ledig tid i Europe/Stockholm och en syntetisk testkund. Skriv `ja` för att skapa bokningen; `nej` eller stängd standardindata avbryter utan skrivning. Bokningen syns sedan i `/admin`. Standardklienten bokar aldrig; enbart `--admin` behåller kampanjutkastflödet. Inget externt AI-API krävs.

MCP-serverns nya `create_booking` exponeras endast med **både** `--admin --allow-bookings`. Starten kräver en lokal SESSION_SECRET om minst 32 tecken för den befintliga HMAC-kvoten. Saknad adminflagga eller hemlighet stoppar skrivläget med statisk felkod. Endast betrodda lokala processer får dessa flaggor; detta är inte fjärrautentisering eller pilotstöd.

Verktyget kräver `serviceId`, `start` (ISO-instant med offset), `customerName`, `customerEmail` (endast `example.test`), `clientRequestId` (1–64 tecken, samma regel som HTTP:s idempotensnyckel) och `confirmed: true`. Okända fält nekas. `confirmed` är klientens försäkran, inte tekniskt bevis på en människas godkännande. Använd samma nyckel och uppgifter vid retry; ändrade uppgifter kräver ny nyckel. Nycklar delar samma befintliga namnrymd som HTTP inom demosalongen.

Svaret innehåller endast `id`, `serviceId`, `startsAt`, `endsAt` i UTC. Samma domänmotor, överlappsskydd, idempotens och dagstak används som i webben. Den lokala MCP-kanalen har **ett gemensamt tak på fem nya bokningar per skapandedag i Stockholm**, även efter processomstart, samt tre per e-postnyckel. Det är ett avsiktligt begränsat testläge, inte individuella agentkvoter. Replays förbrukar ingen ny kvot. Ingen klientstyrd IP/kvotidentitet accepteras.

`list_bookings` i adminläge kräver nu `from` och `to` som inkluderande datum `YYYY-MM-DD` i Europe/Stockholm, högst 31 kalenderdagar. `limit` är valfri (standard 20, max 100) och `cursor` är valfri. Exempel på argument:

```json
{ "from": "2026-11-16", "to": "2026-11-22", "limit": 20 }
```

Svaret har `bookings` och `nextCursor`. Varje bokning innehåller bara `id`, `startsAt`, `endsAt` och tjänstens `id`/`name`, aldrig kundnamn eller e-post. Använd `nextCursor` som `cursor` med samma datumintervall för nästa sida; `null` betyder sista sidan. Endast bokningar vars **start** ligger inom datumintervallet räknas. Tiderna i svaret är UTC. Sidmarkören måste fortfarande finnas i den aktuella verksamheten och intervallet; om den tagits bort får klienten börja om. Pagineringen ger ingen fryst ögonblicksbild vid samtidiga ändringar. ID, tid och tjänst kan fortfarande vara personuppgifter.

Detta är en avsiktlig brytande ändring: tidigare `list_bookings` utan argument och fullständiga kundposter fungerar inte längre. Ingen funktion för utlämning av kunduppgifter finns i MCP. `--admin` är fortsatt bara ett lokalt förtroendeläge, inte fjärrautentisering.

Det andra kommandot skapar ett riktigt utkast i demodatabasen. MCP använder strukturerade argument, exempelvis `serviceId: "fotvard"`, `discountPercent: 20`, `validFrom: "2026-11-16"` och `validUntil: "2026-11-22"`. Agenten ansvarar för att tolka exempelvis ”nästa vecka” till datum; servern validerar fälten och publicerar aldrig automatiskt.

## Kontrollera

```powershell
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
```

Integration och Playwright kräver en migrerad, seedad separat databas och `.env`. Testgrinden tillåter bara localhost/127.0.0.1/::1 och databasnamn som slutar med `_test` eller `_demo`; testerna skapar och tar bort sina egna syntetiska poster. Kör aldrig testerna mot produktionsdata. E2E startar en lokal Next-server på port 3000. Integrationstestet provar konkurrerande förfrågningar och en direkt insättning mot databasspärren. Enhetstester täcker sommartid/vintertid och datumvalidering.

## Avgränsningar

Admininloggningen är en minimal lokal lösning med socketbaserad processlokal spärr, serveråterkallad logout och global sessionsversion, men utan individuella konton, återställning eller revisionslogg. Endast stdio-processens ägare bestämmer MCP-adminläget. Delade cookies, tenant-isolering, HTTPS, säker konfiguration, missbruksskydd, tillgänglighet, integritet och säkerhetsgranskning krävs inför verklig drift. Den signerade cookien kräver HTTPS i `NODE_ENV=production`; kör `npm run dev` för lokalt HTTP. Pris och erbjudande är information, ingen debitering. Översättningsförberedelsen är begränsad: några texter ligger i `src/lib/i18n.ts`, men flertalet är ännu svenska i komponenterna. Kalendern är en kronologisk agenda, inte en fullständig veckovy.

[Omfattning](docs/POC_SCOPE.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Tekniska principer](docs/ENGINEERING_PRINCIPLES.md) · [Underhållsgranskning](docs/MAINTENANCE_REVIEW.md) · [Licens- och projektgranskning](docs/OPEN_SOURCE_REVIEW.md) · [Verifiering](docs/VERIFICATION.md) · [Bidra](CONTRIBUTING.md)

Projektets egen kod är AGPL-3.0-only, se [LICENSE](LICENSE). Paket och tillgångar har egna licenser. Före distribution eller nätverksdrift måste licensuppfyllelse och ett fungerande erbjudande om motsvarande källkod för den körda versionen ordnas; se granskningen.

## Historik — verifiering av Epic 01 QA batch 3

Bas `056d0c2`, branch `epic-01-foundation-hardening`. Fixpunkter 1–5 samt små förbättringar i punkt 6; Visa e-post är fortsatt undantagen. Inga nya beroenden eller migrationer. Endast lokala commits i denna omgång, ingen push eller merge. Aktuella kommandon, resultat och felhistorik: [VERIFICATION](docs/VERIFICATION.md).

Audit-fynden kvarstår i Prisma/config/deepmerge-ts och ESLint-kedjan. [Separat Prisma 7-plan](docs/PRISMA_7_PLAN.md). GitHub Actions test-/byggjobb för föregående `056d0c2` har verifierats grönt, dess audit-jobb rött. Den lokala batch 3-revisionen har inte körts i extern CI. Verklig TLS/proxydrift återstår.
## HTTP-start och betrodda proxyadresser

`npm run dev` och `npm run start` använder `scripts/server.mjs`, en liten Node-startpunkt runt samma Next-app. Den läser socketens remoteAddress och skriver över interna, signerade adressheaders. Nexts route-objekt exponerar inte socketadressen. **Använd dessa npm-kommandon, inte direkt next dev/next start.** Utan verifierad intern adress nekas bokning/login; ingen global reservbucket finns. Produktionsläget använder kompilerad Next med dev:false. Ingen extra tjänst eller npm-dependency.

TRUST_PROXY_IP=0 är standard: verklig socketadress används och X-Real-IP ignoreras. TRUST_PROXY_IP=1 kräver TRUSTED_PROXY_IPS, en kommaseparerad IP/CIDR-lista. Saknad/ogiltig lista stoppar starten. X-Real-IP används bara när anslutande socket matchar listan. Proxyn måste själv skriva över headern med faktisk klientadress. Lista aldrig hela internet eller vanliga klientnät som betrodda. Testerna simulerar proxy med en separat verklig loopback-källadress, 127.0.0.10/32; detta är ingen driftskonfiguration. BOOKING_ADDRESS_SECRET genereras internt vid start och ska inte konfigureras eller delas.

Fem felaktiga login per klient/15 minuter. Därefter nekas alla försök med 429 innan lösenordet kontrolleras, även korrekt lösenord. Felaktiga och spärrade svar fördröjs minst 100 ms asynkront. Andra klienter kan fortfarande logga in; delad NAT delar spärren. Bokningsförsök begränsas till 30 per adress/15 minuter. Vid 10 000 buckets evikteras äldsta posten i stället för att spärra nya klienter. Räknarna är processlokala; omstart och flera processer kräver andra driftkontroller.

## Bokning, sessioner och kampanjer

- Tre nya bokningar per e-postnyckel och skapandedag i Stockholm. Nyckeln använder gemener utan +tagg; kontaktadressen behåller taggen. Detta är en POC-regel, inte universell e-postidentitet. Inga leverantörsspecifika punktregler eller e-postverifiering.
- Fem nya bokningar per verifierad klientidentitet (IPv4-adress eller IPv6-/64) och skapandedag, även med olika e-postadresser. HMAC lagras som clientKey, inte rå IP. Transaktionslås säkrar båda taken. Användare bakom samma NAT delar taket; olika IP kan kringgå det. Det är inte pilotsäkert identitetsskydd.
- Valfri Idempotency-Key, 1–64 tecken [A-Za-z0-9_-]. Samma nyckel/payload ger ursprunglig 201/ID utan att förbruka försöksbudget eller dagstak. Annan payload ger 409 och räknas som försök. UI återanvänder UUID vid retry/dubbelsubmit för samma payload, men nyckeln överlever inte sidomladdning. Servernycklar lever med bokningen.
- Logout sätter revokedAt i AdminSession innan cookien raderas. Kopierad cookie nekas efter logout. DB lagrar tokenhash och skapande/utgång/återkallelsetid. Gamla cookies slutar fungera. ADMIN_SESSION_VERSION är global kill switch: höj och starta om alla instanser; återanvänd inte gamla värden. Vid lyckad inloggning gallras högst 100 utgångna eller återkallade sessioner. Utan nya inloggningar körs ingen gallring. ADMIN_SESSION_VERSION får bara höjas: sänkning kan återaktivera äldre, ännu aktiva sessioner. Individuella konton saknas.
- Admin visar idag till idag+14 inklusive, max 31 dagar/100 rader per sida. Felaktiga datumfilter ger svensk text och standardintervall, inte 500. E-post förblir maskerad. Datum anges YYYY-MM-DD i textfält med validering; kalenderpopupen är ersatt.
- Kampanjer visas endast inom giltiga Stockholmsdatum, högst 90 inkluderande kalenderdagar. Omvända datum och för lång period har olika meddelanden. **100 % rabatt tillåts** i informations-POC:n; ingen betalning/debitering görs. Kommersiella regler måste beslutas före pilot.

## Reproducera testerna

Skapa en ny lokal *_test-databas, exempelvis med `docker compose exec db createdb -U booking booking_lab_test`, och peka lokal .env på den. Bevara befintliga databaser. Alternativet är separat lokal PostgreSQL; denna körning använde PostgreSQL 18.6. Kör npm ci, prisma generate, migration och seed enligt startanvisningen.

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:CHECKPOINT_DISABLE='1'
npm run lint
npx tsc --noEmit
npm test
npm run test:integration
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
npm run build
$env:E2E_PRODUCTION='1'
$env:TRUST_PROXY_IP='0'
npm run test:e2e
$env:TRUST_PROXY_IP='1'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
Remove-Item Env:TRUST_PROXY_IP
node --env-file=.env scripts/test-cleanup.mjs
npm audit
```

Alternativt `npm run test:e2e:production` bygger och kör hela produktionssviten. Cleanup-proben framkallar avsiktlig timeout i separat Playwright och godkänner endast förväntad exit 1 plus noll kvarvarande syntetiska bokningar/kampanjer. Kör bara en QA-omgång i taget mot samma miljö/port. Fixture-städning klarar timeout när DB är tillgänglig, inte processkill, strömavbrott eller DB-avbrott.

MCP-klienter skickar explicit förälderns DATABASE_URL; exporterad miljö vinner över env-filen. Ett integrationstest pekar env-filen på en annan oanvändbar databas och bevisar att utkastet hamnar i exporterad testdatabas.

[Tredjepartsnotiser](THIRD_PARTY_NOTICES.md) · [Datakarta](docs/DATA_FLOWS.md) · [Handoff](docs/HANDOFF.md)


### Driftmatris och varning efter QA batch 3

| Anslutning | Konfiguration | Identitet och krav |
| --- | --- | --- |
| Direkt till Node | `TRUST_PROXY_IP=0` | Verklig socket; inkommande forwarding ignoreras och ger en statisk varning en gång. |
| Betrodd proxy | `TRUST_PROXY_IP=1`, snäv `TRUSTED_PROXY_IPS` | Proxyn måste skriva över `X-Real-IP` med faktisk klientadress. Begränsa även nätåtkomsten till Node. |
| Proxy med standardläge eller bara X-Forwarded-For | Felkonfiguration | Alla delar proxyns identitet, spärr och bokningstak. `PROXY_CLIENT_IDENTITY_COLLAPSED` varnar en gång, utan IP eller headerinnehåll. Åtgärda före drift. |

Proxylistan avvisar IPv4-prefix kortare än /8 och IPv6-prefix kortare än /32. Dessa gränser innebär inte att stora tillåtna nät är lämpliga; lista endast de verkliga proxyadresserna. IPv6-klienters /64 används för både inloggningsspärr och bokningstak; rå adress används fortfarande för att kontrollera betrodd proxy. IPv4-mappad IPv6 normaliseras till IPv4. Gammal IPv6-/128-bokningshistorik räknas inte retroaktivt mot /64-taket. Inga historiska migrationer ändras.

Test- och demovakten avvisar även `host`/`hostaddr` i URL-parametrar före databasåtkomst. E2E-fixturer tar bort sina egna sessionshashar, även efter timeout, men är inte en generell datagallring.
