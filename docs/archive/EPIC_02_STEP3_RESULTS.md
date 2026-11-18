# Epic 02 — första MCP-granskningen, 2026-11-12

Bas 02edeaf. Omfattning E02-1–3 och tidiga E02-4-regressioner. Ingen ny dependency, migration eller ändrat HTTP-kontrakt. Nytt opt-in-verktyg create_booking kräver --admin och --allow-bookings samt SESSION_SECRET; endast example.test och confirmed=true, obligatorisk idempotensnyckel, strikt schema. Fast serverbestämd MCP-kanal går genom befintlig createBooking/HMAC och samma databasregler.

## Faktiskt kört

Ny separat PostgreSQL 18.6 på 127.0.0.1:55448, booking_epic02_test. Alla tre historiska migrationer applicerade, seed körd. Endast syntetiska uppgifter. Ingen extern CI eller push.

| Kommando | Resultat |
| --- | --- |
| npx prisma generate | PASS, Prisma 6.19.3 |
| npm run db:migrate | PASS, 3 migrationer på ny databas |
| npm run db:seed | PASS, exit 0 |
| npm test -- --run tests/mcp-booking.test.ts | PASS, 12/12 |
| npm run test:integration -- tests/integration/mcp-booking.test.ts | PASS, 8/8, 17,72 s |
| npm run lint | PASS |
| npx tsc --noEmit | PASS efter rättning av testets subprocess-env-typ |
| npm test | PASS, 40/40, 6 filer, 2,08 s |

Första samlade kontrollen stannade i tsc: tests/integration/mcp-booking.test.ts saknade det av Next globalt deklarerade NODE_ENV i subprocess-miljön. Testet sätter nu uttryckligen NODE_ENV=test; ingen produktionsregel ändrades. Unit kördes först efter rättningen och passerade. Befintlig Vite-loader-varning kvarstår.

Integration bevisar nekad skrivning utan båda flaggorna, statiska negativa starter, adminfråga med maskerad e-post, minimerade svar, strikt validering, idempotenskonflikt, 20 parallella retries/1 rad, blandade 30/60-minuters domän-/MCP-anrop/1 vinnare och SQL-kontroll utan överlapp, e-posttak/kanaltak inklusive processomstart och replay efter tak, samt sanerat verkligt databasanslutningsfel. Testerna städar egna bokningar och stänger klienterna.

## Återstår

Full integrationssvit tre gånger, hela E2E-matrisen, testklient ja/nej/EOF, MCP-till-admin i browser, cleanup-probe, build, slut-audit och Epic-demo återstår. Testklienten är separat pågående arbete och ingår inte i första frysta serverrevisionens QA. Grok ska granska den angivna committen, inte arbetskatalogens senare ändringar. Ingen Epic-slutbedömning ännu.
