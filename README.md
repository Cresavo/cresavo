# Booking Lab SE – bokningssystemet

Ett bokningssystem för salonger och liknande verksamheter, byggt för att både
människor och AI-agenter ska kunna arbeta i det. Ägaren använder en vanlig
arbetsyta eller sin egen assistent (Claude, ChatGPT med flera) via MCP och API,
med samma regler och godkännanden.

> **Status:** lokal prototyp med syntetiska data. Ingen kundpilot och ingen
> produktionsdrift. Se [STATUS](docs/STATUS.md) och [ROADMAP](docs/ROADMAP.md).

Agentgatewayen (den publika REST/MCP-ingången för externa agenter) ligger i det
separata repot [booking-lab-gateway](https://github.com/niclasvestlund-YT/booking-lab-gateway).
Kontraktet mellan dem beskrivs i [GATEWAY_SPLIT](docs/GATEWAY_SPLIT.md).

## Kom igång lokalt

Krav: Node.js 22.12+ (eller 24+), npm, Docker med Compose. Port 5432 och 3000 lediga.

```bash
cp -n .env.example .env        # sätt SESSION_SECRET (minst 32 slumpade tecken)
docker compose up -d --wait
npm ci
npx prisma generate
npm run db:migrate
npm run db:seed
npm run admin:manage -- create admin@example.test
npm run dev                    # använd alltid npm-skripten, inte next dev direkt
```

Öppna http://localhost:3000 för kundbokning och http://localhost:3000/admin för
salongens arbetsyta. Seeden skapar syntetiska tjänster och två medarbetare.

## Kontrollera

```bash
npm run lint
npx tsc --noEmit
npm test                       # enhetstester
npm run test:integration       # kräver lokal databas som slutar på _test
npx playwright install chromium && npm run test:e2e
npm run build
```

Integration och E2E vägrar köra mot annat än en lokal databas vars namn slutar
på `_test` eller `_demo`.

## Ägar-MCP (lokalt)

```bash
npm run mcp:client                         # läsläge: tjänster och lediga tider
npm run mcp:client -- --admin --workspace  # arbetsytan, varje skrivning kräver "ja"
```

Servern lyssnar inte på nätverket. `--admin` är en lokal förtroendeflagga, inte
fjärrautentisering. Fjärranslutning från Claude/ChatGPT är nästa stora steg i
[ROADMAP](docs/ROADMAP.md).

## Var saker finns

| Sökväg | Innehåll |
|---|---|
| `src/app/` | Webben: kundbokning (`page.tsx`) och arbetsytan (`admin/`) |
| `src/app/api/` | Interna API:er för webben och salongens provider-API `/api/v1` |
| `src/lib/domain.ts` | Bokningsreglerna, gemensamma för webb, API och MCP |
| `src/lib/` | Övrig serverlogik: schema, tid, kunder, kvoter, inloggning |
| `src/mcp/` | Lokal ägar-MCP och experimentella MCP-kort |
| `src/lib/agent-api/` | Agentregler: nycklar, mandat, förslag, logg och OAuth |
| `prisma/` | Datamodell och migrationer |
| `tests/` | Enhets-, integrations- och E2E-tester |
| `scripts/` | Server-wrapper, seed, testvakter och verktyg |

## Dokumentation

- [STATUS](docs/STATUS.md) – vad som fungerar och vad som saknas just nu
- [ROADMAP](docs/ROADMAP.md) – riktning, faser och affärsmodell
- [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATA_FLOWS](docs/DATA_FLOWS.md) ·
  [PRIVACY_SECURITY](docs/PRIVACY_SECURITY.md) ·
  [ENGINEERING_PRINCIPLES](docs/ENGINEERING_PRINCIPLES.md) ·
  [ADMIN_OPERATIONS](docs/ADMIN_OPERATIONS.md)
- [docs/archive](docs/archive/README.md) – tidigare planer, QA-rapporter och bevis

## Licens

AGPL-3.0-only, se [LICENSE](LICENSE) och [CONTRIBUTING](CONTRIBUTING.md).
