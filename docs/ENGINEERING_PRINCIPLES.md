# Tekniska principer

## Enkelhet och läsbarhet

- Skriv små, sammanhängande ändringar med tydliga namn och lättläst kontrollflöde. Optimera för att en ny utvecklare eller agent kan följa en funktion från gränssnitt till databas.
- Lägg kod där den behövs. Extrahera en funktion eller modul när den minskar verklig duplicering eller gör en regel tydligare; bygg inte generiska lager för möjliga framtida behov.
- Radera kod och direkta beroenden först efter att referenser, genererade/anropade ingångar och verktygskonfiguration kontrollerats. Håll `package.json` och låsfilen synkroniserade. Ett transitivt beroende kan finnas kvar även när en direkt deklaration tas bort.
- Nya beroenden kräver konkret nytta, licens- och underhållsbedömning och uppdaterad låsfil. Undvik automatiska major-uppgraderingar.

## Domän och gränser

- `src/lib/domain.ts` är gemensam serverlogik för webb och MCP; håll boknings- och kampanjregler där eller i närliggande domänkod. Gränssnitten ska inte ha egna alternativa bokningsregler.
- Validera externa indata på servern. Bevara skillnaden mellan publik och administrativ åtkomst, origin-kontroller, signerad cookie och lokalt MCP-adminläge. MCP-adminflaggan är inte fjärrautentisering.
- PostgreSQL:s exclusion constraint är sista skyddet mot överlapp. Frontendkontroller eller en tillgänglighetsfråga ersätter inte databasens integritetsregel. Bevara halvöppna intervall och kontrollera samtidighet mot en riktig PostgreSQL.
- Lagra instanter i UTC och tolka lokala datum och öppettider i `Europe/Stockholm`; testa sommar- och vintertid. Lagra pengar som heltal i ören och formatera för `sv-SE`.
- `businessId` i POC:n är inte tenant-isolering. Lägg inte till fler företag utan genomgående behörighets- och dataseparering.
- Ändra inte befintliga HTTP- eller MCP-kontrakt, säkerhetskontroller eller historiska migrationer av slentrian. En datamodellsändring kräver en ny migration och kompatibilitetsbedömning.

## Tester, data och dokumentation

- Använd endast syntetiska kunduppgifter. Lägg aldrig hemligheter, `.env`, databaser eller testresultat i Git. Projektet ska inte lagra journaler eller hälsouppgifter i POC:n.
- Kör `npm run lint`, `npm test`, `npm run test:integration`, `npm run test:e2e` och `npm run build` när ändringen berör respektive del. Integration och E2E körs mot en isolerad migrerad och seedad PostgreSQL, aldrig produktionsdata. Redovisa faktiska kommandon, fel och icke körda kontroller.
- Skriv tester för riskfyllt beteende och kontrakt, särskilt tidszoner, validering, behörighet och samtidighet; undvik tester som bara upprepar implementationen.
- Uppdatera README, arkitektur eller verifieringsrapport när verkliga startsteg, avgränsningar eller verifieringsresultat ändras. Håll tidigare observationsdatum tydliga.
- Respektera AGPL-3.0-only och tredjepartslicenser; dokumentera ursprung och kompatibilitet före kodåteranvändning. Ingen extern publicering utan uttryckligt uppdrag.
