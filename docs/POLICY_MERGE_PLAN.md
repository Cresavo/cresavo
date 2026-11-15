# Windows-policy → agentprov-2 · plan, ingen merge

Kontrollerat 2026-11-15 med faktisk Git-jämförelse. Fryst QA-bas:
`e890b696bbba422c3885696df6b4282d8f33948a` på codex/agentprov-1.
Policytip: `b241d8a50734bf3607f6b4314c1ad13c73915e91`; granskad kod/test:
`a101704fdc05f553145aff24643bca5564bc03c9`.
Gemensam förfader: `121a229b9d2b86724ff8cd7192e249a40a1c02ca`.
`git diff a101704 b241d8a -- src prisma scripts tests package.json package-lock.json
next.config.ts` ger tom output. Senare policytip innehåller rapporter och
attribut, inte ny produktkod; gamla QA-resultat ersätter inte ett nytt mergeprov.

## Faktisk konfliktkontroll

```text
git merge-tree --write-tree --name-only e890b69 b241d8a
exit 1
CONFLICT (content): Merge conflict in README.md
CONFLICT (content): Merge conflict in docs/ARCHITECTURE.md
CONFLICT (content): Merge conflict in docs/HANDOFF.md
CONFLICT (content): Merge conflict in docs/PROJECT_STATUS.md
CONFLICT (content): Merge conflict in docs/VERIFICATION.md
```

Kommandot beräknade ett tillfälligt Git-träd, ingen mergecommit, indexändring
eller branchflytt. Full output: <local-scratch>/agentprov-2/policy-merge-tree.txt.
Eftersom det **inte är rent** görs bara denna plan enligt Niclas instruktion.
AGENTS, schema och domain.ts auto-mergear textmässigt; det är inte ett
semantiskt godkännande.
Detta konfliktutfall gäller jämförelsen med fryst e890b69. Agentprov-2:s nya
plats-/schemafält och upptäckbarhet kräver en ny konfliktkontroll vid ett
senare sammanföringstillfälle, inte återanvändning av det tillfälliga trädet.

## Överlapp att bevara

| Yta | Policygrenen | Gatewaygrenen / risk vid sammanföring |
| --- | --- | --- |
| domain.ts | Gemensam framförhållning, bokningshorisont och audience customer/staff | Bevara AGENT_API_CHANNEL och authorize/beforeInsert/booked-hooks; de måste fortsätta ligga i samma transaktion. Inget byte till policygrenens hela fil. |
| Tillgänglighet | Kundens policyfönster; separat personalvy | REST/MCP ska använda kundregler. Ett giltigt mandat får aldrig utöka salongens policy. Befintliga adminundantag måste förbli serverbestämda. |
| Replay och lås | Replay före ny policyprövning, befintlig konfigurationslåsning | Aktuell credential/ägare måste ändå kontrolleras före replay. Bibehåll idempotens-, klient-/e-post- och personal/daglås samt exclusion constraint. |
| Schema/migration | BookingPolicy, 20261114182000_booking_policy | AgentClient/AgentMandate/AgentBooking och nya platsfält. Alla historiska filer ska behållas byte-identiska; verifiera både tom DB och uppgradering av e890-data. |
| Lokal MCP / webb | Policyredigering, policiesvar, customer/staff-fönster | Behåll native gateway och USP-alias utan lokala adminverktyg på nätet. Policyn får inte bara gälla webben. |
| Skapa/flytta/avboka | Ändringsgränser och versionskontroller | Existing agent cancel behöver ett separat beslut om hur policygräns och bokningsmandat ska samverka. Inget sådant kontrakt införs i denna omgång. |
| Rapporter | Policy-GO gäller a101704 | Agentprov-1 är fryst för separat QA. Slå inte ihop deras resultattabeller till ett påhittat gemensamt GO. |

## Rekommenderad ordning för ett senare separat mergeprov

1. Invänta QA för fryst agentprov-1. Spara referenser till båda exakta tipsen;
   inga flyttade gamla brancher, force-push eller blind rebase.
2. Skapa ny integrationsworktree från den då uttryckligen valda gatewaybasen.
   Gör normal lokal merge; lös endast de dokumentkonflikter som Git faktiskt
   visar. Behåll båda historikerna och välj en ny aktuell rapport överst.
3. Granska den auto-mergade transaktionen manuellt: policykontroll för nya
   kundbokningar, mandatets aktuella tjänst/pris/plats, atomisk koppling och
   credentialkontroll på replay. Lägg regressioner för policy genom båda
   gatewaytransporterna, även giltigt mandat utanför policy och policyändring
   mellan availability och create.
4. Kör fresh migrate/seed, samt uppgradering av en syntetisk e890-databas med
   befintliga nycklar/bokningar/mandat. Bevara ägare, gamla scopes och replay.
   Kör policy-, gateway-, konflikt-, schema- och säkerhetsregressioner, därefter
   lint, tsc, alla unit/integration, build och berörda webb/MCP-flöden.
5. Rapportera faktiskt resultat för den nya kombinerade revisionen. Om något
   faller behåll grenarna separata. Push/PR/deploy är inte del av denna plan.
