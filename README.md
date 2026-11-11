# booking-lab-se

En liten lokal, svensk boknings-POC för en fiktiv salong. Next.js, TypeScript, PostgreSQL/Prisma och lokal MCP över stdio. Endast syntetiska uppgifter. **Inte för produktion eller riktiga kunder.**

## Starta lokalt

Förutsättningar: Node.js 22.12 eller senare (alternativt 24 eller senare), npm och Docker med Compose. Port 5432 och 3000 måste vara lediga. I projektkatalogen:

```powershell
Copy-Item .env.example .env
# Redigera .env: välj ADMIN_PASSWORD (minst 12 tecken) och SESSION_SECRET (minst 32 slumpmässiga tecken).
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Öppna http://localhost:3000 och välj en vardag inom 60 dagar. Salongen har öppet måndag–fredag 09–17 i Europe/Stockholm, en anställd och tider på halvtimmar. Logga in via `/admin` med lösenordet i `.env`. Seeds kan köras igen utan att radera bokningar. För en egen Postgres-instans, ändra `DATABASE_URL` i `.env`; databasanvändaren måste kunna skapa extensionen `btree_gist`. Compose-lösenordet är endast avsett för lokal demo. Stoppa databasen med `docker compose stop`; volymen sparas.

## MCP

En betrodd lokal MCP-klient kan starta `node --env-file=.env --import tsx src/mcp/server.ts` i projektkatalogen. Standardläget erbjuder `list_services` och `get_availability`. Administratören kan uttryckligen lägga till argumentet `--admin`; då tillkommer `list_bookings` och `create_campaign_draft`. Ge endast betrodda lokala klienter adminläget: flaggan är en lokal behörighetsgräns, inte säker fjärrautentisering. Servern lyssnar inte på något nätverksuttag. Utkastet publiceras manuellt i administrationen.

Prova med den medföljande klienten:

```powershell
npm run mcp:client
npm run mcp:client -- --admin
```

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

Integration och Playwright kräver den migrerade, seedade lokala databasen och `.env`; testerna skapar och tar bort sina egna syntetiska poster. Kör aldrig testerna mot produktionsdata. E2E startar en lokal Next-server på port 3000. Integrationstestet provar konkurrerande förfrågningar och en direkt insättning mot databasspärren. Enhetstester täcker sommartid/vintertid och datumvalidering.

## Avgränsningar

Admininloggningen är en minimal lokal lösning utan konton, spärr mot lösenordsgissning, återställning eller revisionslogg. Endast stdio-processens ägare bestämmer MCP-adminläget. Delade cookies, tenant-isolering, HTTPS, säker konfiguration, missbruksskydd, tillgänglighet, integritet och säkerhetsgranskning krävs inför verklig drift. Den signerade cookien kräver HTTPS i `NODE_ENV=production`; kör `npm run dev` för lokalt HTTP. Pris och erbjudande är information, ingen debitering. Översättningsförberedelsen är begränsad: några texter ligger i `src/lib/i18n.ts`, men flertalet är ännu svenska i komponenterna. Kalendern är en kronologisk agenda, inte en fullständig veckovy.

[Omfattning](docs/POC_SCOPE.md) · [Arkitektur](docs/ARCHITECTURE.md) · [Licens- och projektgranskning](docs/OPEN_SOURCE_REVIEW.md) · [Bidra](CONTRIBUTING.md)

Projektets egen kod är AGPL-3.0-only, se [LICENSE](LICENSE). Paket och tillgångar har egna licenser. Före distribution eller nätverksdrift måste licensuppfyllelse och ett fungerande erbjudande om motsvarande källkod för den körda versionen ordnas; se granskningen.

## Kända verifieringsresultat och risker (2026-11-11)

På Windows/Node 24 med en separat lokal PostgreSQL 18-instans passerade lint, tre enhetstester, tre integrationstester, två Playwright-flöden (desktop och mobil) samt produktionsbuild. Compose-filen har inte kunnat startas på denna dator eftersom Docker saknas; instruktionerna för Compose är därför inte end-to-end-verifierade här.

`npm audit` rapporterade 10 poster: tre höga i kedjan Prisma CLI → @prisma/config → deepmerge-ts (samma bakomliggande [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) och sju måttliga i ESLint/TypeScript ESLint → minimatch ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). Dessa verktyg ska inte hantera opålitliga konfigurationer eller köras publikt. `npm audit fix` löste inte dessa i den låsta trädet; den föreslagna Prisma-uppgraderingen är en större migrering som behöver egen testning. Auditens antal räknar även beroendekedjans påverkade paket, inte tio oberoende sårbarheter.
