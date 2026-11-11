# Produktägarrapport – Epic 01 QA fix batch 2

2026-11-11, kod a84e48a. Lokala commits på epic-01-foundation-hardening. Ingen push; repot förblir privat.

**Vad har vi byggt?** Fixbeställningens punkter 1–5 och 7–11. En besökare delar inte längre global spärr med alla andra, IP-headers måste komma från rätt proxy, logout återkallar även kopierad cookie, retry skapar ingen dubblett och felaktiga adminfilter visar ett begripligt meddelande. Punkt 6 (Visa e-post) är inte byggd.

**Vad kan jag testa nu?** Boka, kontrollera bekräftelsen, logga in, prova datumfilter, skapa/publicera lokalt MCP-utkast och logga ut. [Demoanvisning](DEMO.md) och [nytt galleri med tolv bilder/två videor](../demo-artifacts/2026-11-11T21-04-56-806Z/index.html). Inspelat från ren commit a84e48a; granskade bilder visar YYYY-MM-DD och logout i sidhuvudet utan N-badge. Videofilerna går att läsa men är inte fullständigt genomtittade.

**Vad blev bättre?** Tydligare säkerhetsgräns och UX. Tester täcker både standard-/proxyläge och hela produktionsflödet. Teststädning klarar avsiktlig timeout, och MCP använder samma exporterade databas som webben. Inga nya paket eller ändrade historiska migrationer.

**Vad fungerar fortfarande inte för pilot?** Delat adminlösenord, ingen GDPR-livscykel/sessionsgallring, kvarvarande audit (3 höga + 7 måttliga), processlokalt/IP-baserat skydd och ej verifierad TLS/proxy/Docker/CI. E-post är fortsatt maskerad. Kampanjlista och CSP har tidigare dokumenterade begränsningar. Fortsatt NO-GO för riktiga kunder.

**Testresultat:** 20 unit, 16 integration, åtta E2E i varje av fyra lägen, lint/tsc/build och produktionsdemo PASS. [Faktisk output och begränsningar](VERIFICATION.md), [handoff](HANDOFF.md).

**Tre nästa mål:** oberoende QA av denna revision; separat audit-/driftverifiering; individuell adminåtkomst och beslutad/testad datalivscykel före pilot. Ingen Epic 02 har startats.

## Historik – rapport från batch 1

Senaste kodrevision: `3b3309d` (endast återstående formatering efter funktionellt testade `26ea617`); lint/tsc/build/Prettier omkörda PASS.

Verifierat 2026-11-11, kodcommit `26ea617` på `epic-01-foundation-hardening`. Ingen ny Epic eller extern publicering.

**Vad har vi byggt?** Rättat QA-fynd: säkrare bokningsförsök/retries, utloggning och global återkallelse, begränsad adminlista med maskerad e-post, headers, kampanjregler och fler samtidighets-/negativtester. Historiskt överlappsskydd bevarat; inga nya npm-beroenden.

**Vad kan jag testa nu?** Boka, se behandling/tid i bekräftelsen, hitta bokningen i admin, publicera lokalt MCP-utkast och logga ut. Följ [demoanvisningen](DEMO.md). [Produktionsgalleri: tolv bilder och två videor](../demo-artifacts/2026-11-11T19-51-02-683Z/index.html). Inga N-badges; syntetisk data.

**Vad blev bättre?** 20 samtidiga retries skapar en bokning; överlapp ger begripligt fel. Kunders e-post visas inte rutinmässigt i admin och aldrig i MCP. Testerna vägrar fel databas. Bekräftelsen är tydligare och prisformatet gemensamt.

**Vad fungerar fortfarande inte?** Audit är röd (3 höga + 7 måttliga). Delat adminlösenord och processlokala spärrar räcker inte för kunddrift. Docker/CI, riktig TLS/proxy, backup och GDPR-rutiner är inte verifierade. Datumfältets format följer fortfarande webbläsarmiljön. Detta är en testad POC, inte en produktionsklar tjänst.

**Resultat:** 14 unit + 14 integration + 6 E2E PASS, lint/tsc/build PASS, produktionsdemo 2/2 PASS. Faktisk output och ej körda kontroller finns i [VERIFICATION](VERIFICATION.md), överlämningen i [HANDOFF](HANDOFF.md).

**Tre nästa mål:** oberoende QA/Docker/CI och separat auditåtgärd; individuell adminåtkomst och verifierad driftgräns; syntetisk backup-/gallrings-/dataskyddsövning.
