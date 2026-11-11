# Framtida Prisma 7-uppgradering – separat från QA-batchen

Ingen uppgradering görs här. Prisma/client är fortsatt 6.19.3. Målet för en separat förändring är att ta bort Prisma/deepmerge-advisoryn utan att ändra bokningskontrakt eller historiska migrationer.

1. Välj och lås en korrigerad, då aktuell Prisma 7-version tillsammans med matchande klient. Kontrollera audit och verkliga licens-/notice-filer för nya transitiva paket. Använd inte major-overrides.
2. Följ [Prismas v7-guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7): bedöm ESM/TypeScript, generator/output, prisma.config.ts, explicit miljöladdning och PostgreSQL-driveradapter. Adapter/driver ska motiveras, licensgranskas och få dokumenterad poolbudget/TLS-konfiguration. Detta är en migrering, inte bara ett versionsbyte.
3. Prova på en ny isolerad *_test-databas och en syntetisk uppgraderingskopia. Behåll exclusion constraint och gamla migrationer. Verifiera särskilt SQLSTATE-fel från parametriserad INSERT, advisory locks, transaktionstimeout, unique idempotency key och datumtyper.
4. Kör ren installation, generation, migration, seed, hela sviten inklusive 20 samtidiga writes, MCP, produktionens E2E/demo, lint/tsc/build och full/prod audit. Kontrollera genererade artefakter och nya notices.
5. Acceptans: inga kontraktsregressioner, oförändrat överlappsskydd, säker rollback till föregående kod/låsfil och verifierad borttagning av aktuell Prisma-advisory. Besluta först då om merge lokalt. Ingen publicering eller driftändring ingår i planen.
