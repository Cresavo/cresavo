# Underhållsgranskning 2026-11-11

## Genomfört

- Gjort bokningsdomänens och behörighetskodens kontrollflöden läsbara utan avsiktlig beteendeändring. TypeScript-parserns AST jämfördes med tidigare revision och var identisk för båda filerna.
- Tagit bort den direkta deklarationen av `@eslint/eslintrc`: projektets flat config importerar `eslint-config-next` direkt och använder inte `FlatCompat`. `npm explain` visar att paketet fortfarande behövs transitivt av ESLint; detta minskar inte antalet installerade paket och löser inte audit-varningarna.
- Behållit API-kontrakt, regler, migrationer och tester. Inget nytt beroende har lagts till.

## Fynd att hantera separat

- Flera komponenter, rutter, tester och MCP-filer är fortfarande skrivna på mycket långa rader. Formatera dem stegvis med separata, beteendebevarande diffar; inför inte ett nytt formatteringsberoende utan att först besluta om verktyg.
- Tidszonen och svensk pris-/datumformatering förekommer på flera ställen, medan endast några gränssnittstexter ligger i `i18n.ts`. Kartlägg server- och klientgränser innan gemensam formatering eller riktig översättning införs; undvik en överdriven abstraktion.
- `domain.ts` validerar datum och anropar `parseDay` på flera ställen. Förenkling kan göras separat med tester som låser felutfall och hantering av tom tillgänglighet.
- HTTP-felklassificering och överlappsfel identifieras genom meddelandetext, vilket är skört. Utred strukturerade feltyper och Prisma/PostgreSQL-felkoder i en separat ändring som bevarar statuskoder och svarskroppar.
- `campaignSchema` exporteras men har inga andra träffar i repot. Eftersom exporten kan vara en integrationsyta lämnas den orörd tills kontraktet kontrollerats. MCP-testklienten och översättningsfilen har faktiska anrop och är inte död kod. Inga övergivna spårade experiment identifierades; sökningen bevisar inte att all kod används externt.
- Den nuvarande adminlösningen, single-tenant-konstanterna, audit-varningarna och den icke verifierade Docker-miljön är dokumenterade begränsningar. Större säkerhets- och datamodellsändringar ska planeras och testas separat.
- En manuell Chromium-kontroll visade datumfältets platshållare som `mm/dd/yyyy` i den använda webbläsarmiljön trots sidans svenska språk. Det inbyggda datumfältets visning kan bero på webbläsarens locale; testa uttryckligen `sv-SE` och andra relevanta miljöer innan ett eventuellt gränssnittsbyte beslutas.
