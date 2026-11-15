# Epic 02 – lokal agentbokning via MCP

**Status: godkänd för lokal implementation 2026-11-12.** Produktägaren har godkänt självständigt arbete enligt avgränsningen, lokala commits och riktad Grok-granskning. Ingen push, merge eller publicering. Senare ospecificerade epics är inte bygguppdrag. Arbetet tidsbegränsas till sex timmar från start; inga nya betalda API-tjänster används.

Bas: godkänd POC-kod dc15023 och lokal avslutningscommit 02edeaffddb3c932a56062e53b80c238abf3402e. Arbetsnamn booking-lab-se. Epic 01 är stängd som lokal POC; pilot är fortfarande NO-GO. Se [projektstatus](PROJECT_STATUS.md).

## Ett avgränsat produktmål

En betrodd lokal operatör ska kunna låta en AI-agnostisk MCP-klient läsa tjänster och lediga tider, bekräfta en syntetisk bokning och skapa den exakt en gång. Bokningen ska synas i befintlig adminvy. Webb och MCP ska använda samma bokningsmotor och integritetsregler.

Endast ett nytt produktverktyg: **create_booking**, över befintlig lokal stdio. Ingen modellleverantör krävs för att prova flödet; den deterministiska testklienten ska kunna demonstrera det.

## Godkända beslut

- Nytt verktyg aktiveras endast när servern startas med både `--admin` och en separat `--allow-bookings`. Befintligt adminläge ändrar inte automatiskt beteende. `--allow-bookings` utan admin ska nekas vid start.
- Verktygets strikta indata: serviceId, start (ISO-instant med offset), customerName, customerEmail, clientRequestId och confirmed=true. Delad domänvalidering återanvänds; ingen andra bokningsmotor. clientRequestId är obligatorisk och följer befintlig Idempotency-Key-regel, 1–64 tecken.
- Operatören bekräftar tjänst, Stockholmstid och syntetisk kund i testklienten före skrivning. confirmed=true är klientens uttryckliga försäkran, **inte tekniskt bevis på mänskligt samtycke**. En betrodd agent kan själv sätta fältet. Ingen ny bokningsutkast-tabell, bekräftelsetoken eller OAuth byggs.
- Endast syntetiska uppgifter används. Testklienten genererar example.test-adresser; verktyget begränsas i denna POC till den domänen. Det ersätter inte en sekretesskontroll av namn/fritext.
- Minimerat lyckat svar: id, serviceId, startsAt och endsAt. Inga kundnamn, e-postadresser, interna hashvärden eller konfiguration tillbaka till modellen. Tider är instanter; testklienten visar dem i Europe/Stockholm.
- Fel följer befintligt MCP-kontrakt med isError och säker statisk text. Befintlig HTTP-status **400 behålls** för upptagen tid; idempotenskonflikt behåller 409. En bred ändring till 409 skjuts upp för att undvika oavsiktligt kontraktsbyte i denna Epic.
- MCP får en fast serverbestämd kvotidentitet för hela den lokala bokningskanalen, skild från HTTP-adresser. Ingen identitet får tas från verktygsargument eller slumpas per process. Befintligt dagstak 5/kanal och 3/e-post gäller; webbens IP-identifiering ändras inte. Att lokala agenter delar kanaltaket är ett avsiktligt POC-beslut, inte individuell användaridentifiering.
- Kvotidentiteten går genom samma createBooking-väg med befintlig HMAC-konfiguration och transaktionsräkning. SESSION_SECRET måste finnas lokalt för bokningsläget; saknad konfiguration ska neka start innan skrivverktyget blir tillgängligt. Hemligheten får aldrig ingå i verktygsargument, svar eller logg. Befintlig minimal subprocess-miljö ska inte ersättas av en kopia av hela miljön; tester får uttryckliga syntetiska värden.
- Inga nya npm-beroenden eller migrationer planeras. Om det visar sig nödvändigt blir det ett beslut för produktägaren, inte ett automatiskt tillägg.

## Utanför scope

Ingen publik/fjärr-MCP, OAuth, individuell agentidentitet, multi-tenancy, avbokning/ombokning, betalning, påminnelser, marknadsföringsintegration, fler salonger/personal, nya öppettider eller bokning över midnatt. Ingen admin-e-postavmaskering. Ingen ny UI behövs utöver eventuell minimal testklientpresentation.

Individuella adminkonton/MFA, kund-GDPR-livscykel, audit-/Prisma-uppgraderingar och riktig TLS/proxy/flerinstansdrift är separata arbeten. Epic 02 innebär inte att pilotblockerarna är lösta. Oförändrade kända audit-fynd ska redovisas; nya fynd ska bedömas, inte döljas eller automatiskt accepteras.

En generell agentplattform eller avancerad nattorkestrering ingår inte i produkt-Epicen.

## Små uppgifter i ordning

Tidsboxarna är stoppgränser för första försöket, inte leveranslöften. Raderna nedan definierar uppdraget; faktisk status och körresultat finns i [NIGHT_WORK](NIGHT_WORK.md) och [VERIFICATION](VERIFICATION.md). Codex implementerar och testar; Grok granskar frysta commits i egen arbetskopia.

| ID | Uppgift / huvudsakliga filer | Acceptanskriterier | Kontroll och tidsbox |
| --- | --- | --- | --- |
| E02-0 | Förbered isolerad arbetsmiljö och frys kontrakt. docs, framtida branch epic-02-local-agent-booking. | Basrevision dokumenterad; befintliga ändringar bevarade; egen loopback *_test-DB och port; de föreslagna besluten ovan godkända. Exakt start/stop och ägare för processer kända. | Codex preflight, 20 min. Ingen produktkod före godkänt startbesked. |
| E02-1 | Delat indataavtal och validering. src/lib/domain.ts, närliggande MCP-schema och unit. | Befintliga HTTP-indata fungerar oförändrat. MCP kräver korrekt clientRequestId och confirmed=true; saknat/falskt bekräftelsefält, okända fält, fel datum, för lång nyckel och annan e-postdomän avvisas. | Unit + lint/tsc; 40 min. Undvik refaktorering utanför berörda fält. |
| E02-2 | Skrivbehörighet och kvotkontext. src/mcp/server.ts samt nödvändig lokal startkonfiguration. | Standard- och enbart adminläge exponerar inte create_booking. Direkt tools/call utan rätt läge nekas utan DB-skrivning. Bokningsflagga utan admin eller utan kvotkonfiguration stoppar starten. Kanalkvoten är stabil mellan nya MCP-processer; inga klientstyrda identiteter accepteras. | Verklig stdio-integration + negativa starter; 45 min. |
| E02-3 | Koppla create_booking till createBooking. src/mcp/server.ts, tests/integration. | Giltigt anrop ger en bokning som går att läsa i befintlig adminfråga. Samma nyckel/payload ger samma id; ändrad payload ger säkert fel och ingen extra rad. Fel fångas av samma sanering. Endast minimerade svarsfält lämnas ut. | Integration för framgång/retry/fel/dataminimering; 45 min. Första riktade Grok-granskningen efter denna commit. |
| E02-4 | Säkra samtidighet och kvoter genom riktiga MCP-anrop. tests/integration. | 20 parallella identiska nycklar ger 1 rad/samma id. Blandade HTTP/domän- och MCP-anrop om överlappande 30/60-minuter ger exakt 1 vinnare, inga 500 eller överlapp. Upptagen, passerad och stängd tid nekas. Fjärde bokningen per e-post och sjätte per MCP-kanal/dag nekas; replay efter nått tak lyckas utan ny kvot. Ny MCP-process kan inte återställa DB-dagstaket. | Riktig PostgreSQL, separat stdio-klient per samtidig grupp vid behov; 45 min. Befintlig stressregression och låsordning bevaras. |
| E02-5 | Gör flödet provbart i befintlig testklient och synligt i admin. src/mcp/client.ts, tests/e2e, README. | Standardklienten gör ingen bokning. Särskilt bokningsläge visar sammanfattning och kräver ett uttryckligt ja före create_booking. Nej/EOF ger 0 skrivningar. Ja ger 1 bokning som E2E hittar i admin med Stockholmstid; kundens e-post är fortsatt maskerad. Klienten skriver inte ut kunddata/hemligheter i resultatlogg. | Testa ja/nej och ett flöde MCP → admin. Minst testad sommar- och vintertidskonvertering; 45 min. Ingen ny bildsekvens under uppgiften. |
| E02-6 | Slutverifiering, dokumentation och en Epic-demo. docs, befintliga tester/demoskript. | Alla slutkriterier nedan passerar eller redovisas som blockerade. Aktuell status och handoff pekar på exakt testad commit. En slutdemo visar MCP-bokningens resultat i admin; terminalstegen kan komplettera befintlig bild/video utan nytt dashboardsystem. | Codex full svit → Grok riktad slutgranskning; 60 min plus eventuell avgränsad rättning. Ingen full omgranskning av oförändrad Epic 01. |

## Definition of Done

- E02-0 till E02-6 har konkreta testbevis och inga öppna blockerande fynd.
- En användare kan följa README för tjänst → ledig tid → bekräftelse → MCP-bokning → befintlig adminvy, enbart lokalt och syntetiskt.
- Ingen obehörig skrivväg eller förbikoppling av domänregler, dagstak, idempotens, låsordning eller exclusion har tillkommit. Rå insertBooking anropas inte från verktyget.
- Strikta indata, minimerade svar och fel utan PII/hemligheter är testade. Leverantörsoberoende verifiering kräver ingen extern modellnyckel.
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` och cleanup-proben passerar. Integrationssviten körs tre gånger efter ändringar i skrivvägen; alla tre måste passera. Vid samtidighetsfel krävs reproduktion och rättning, inte fler omkörningar tills en blir grön.
- Hela E2E-matrisen dev/production × TRUST_PROXY_IP=0/1 passerar en gång på slutrevisionen. Alla testbokningar, kampanjer och sessioner städas. Stressprober har 0 överlapp och 0 deadlocks i egen PostgreSQL-logg.
- Kör npm audit vid slutgrinden och jämför med dokumenterad baslinje; rapportera den fortsatt separat. Kända oförändrade fynd får inte beskrivas som grönt audit-resultat.
- En demo vid Epic-slut, inte per fixrunda. Ange om video inte granskats. Tidigare demo får finnas kvar som historik.
- Om push godkänns senare ska fyra GitHub E2E-jobb kontrolleras på exakt revision. Utan push markeras extern CI som EJ KÖRD, aldrig som PASS. Lokal färdig POC och extern leveransstatus hålls isär.

## Så kan Codex och Grok arbeta över natten

### Startgrind – ännu inte uppsatt eller godkänd

Uppdatering 2026-11-12: produktägaren godkände lokalt självständigt arbete med överlämning genom befintligt Grok-gränssnitt. Kontaktprovet gav KONTAKT_OK och Grok har bekräftat första frysta revisionen. Ingen headless-installation eller ny betald API-loop har satts upp; följande headless-villkor kvarstår för en framtida sådan installation. Den aktuella omgången använder befintliga verktyg, högst sex timmar och inga nya betalda API-tjänster.

Nattkörning startar först efter uttryckligt godkännande av scope och följande villkor:

1. Tillgängliga headless-klienter, autentisering, maskin som hålls vaken samt överlämning av fryst commit och rapport har provats med ett litet jobb som också avslutas korrekt. En chatt eller GitHub-testworkflow i sig håller inte utvecklingsloopen igång. Inga CLI-/API-kommandon antas fungera utan provkörning.
2. Maximal väggtid föreslås vara **6 timmar**. Kostnadstak och vilken tillgänglig prenumeration/API som ska användas måste anges före start. Verktygsstöd för hårt kostnadsstopp ska verifieras; utan det körs ingen obevakad debiterad loop.
3. Codex får skriva i sin arbetsbranch; Grok får läsa en fryst snapshot och köra tester i egen kopia, med egna syntetiska DB-uppgifter. Granskaren ändrar inte produktkoden. Ingen produktionskonfiguration eller verkliga kunduppgifter delas. Rapportfiler innehåller endast nödvändiga syntetiska exempel och inga cookies/nycklar.
4. Lokala commits tillåts vid framtida startgodkännande. **Ingen push, PR-publicering, merge, deploy eller ändrad reposynlighet** utan separat tillstånd. Om Grok bara kan läsa GitHub och ingen godkänd lokal överlämning finns är nattloopen blockerad; push får inte antas godkänd.
5. Bara en testkörning per arbetskopia/databas/port. En enkel jobblåsning i körmiljön ska hindra överlapp. Grok och Codex kan ha separata miljöer, men får aldrig dela .next/test-results eller skriva samtidigt i samma repo.

Ingen nattautomation installeras som del av detta planeringsuppdrag. Om startgrinden inte är uppfylld kan planen köras manuellt i samma ordning, men ska inte presenteras som obevakad nattkörning.

### Arbetsloop och stopp

- Codex tar nästa beroendeuppfyllda uppgift, gör en liten ändring, kör relevanta tester och skapar en commit. Misslyckad uppgift markeras BLOCKERAD; den blir inte grön genom att tester tas bort eller trösklar sänks.
- Grok granskar efter E02-3 samt vid slutet av E02-6. Under mellanliggande uppgifter räcker Codex testbevis. Det begränsar onödiga fram-och-tillbaka-rundor.
- Granskaren lämnar fynd med ID, allvar, exakt commit, reproduktion, förväntat/observerat beteende och brutet acceptanskriterium. Ett möjligt fel utan reproduktion markeras OSÄKERT, inte automatiskt blockerande.
- Blockerare: dataintegritet, behörighet, sekretess, regression, brutet överenskommet kriterium eller oförklarat testfel. Stilpreferenser, alternativa abstraktioner och nya funktioner går till backloggen. Gamla godkända områden öppnas bara med nya konkreta bevis.
- Högst **två rättningsvarv totalt under natten**, utöver första implementationen. Ett varv betyder Codex-rättning följd av riktad Grok-omkontroll. Kvarstående blockerare efter det lämnas till produktägaren; inga oändliga loopar.
- Stoppa vid tids-/kostnadstak, okänd databas, hemlighetsrisk, ändrad scope, behov av nytt beroende/migration/extern behörighet, eller bruten startgrind. Ingen väntan på användarsvar utan slutrapport. Orelaterat arbete får bara fortsätta om det redan är godkänt och inte bygger på det blockerade beslutet.
- Säkerhetsfel utanför INSERT och generell retry-policy byggs inte spekulativt. Vid reproducerat sådant fel stoppas berörd uppgift med bevis och ändringsförslag. Midnattsbokningar är uttryckligen uteslutna.

### Morgonrapport – högst en sida

Rapportera: bas/slutcommit, uppgifts-ID och PASS/BLOCKERAD/EJ KÖRD, vad produktägaren kan prova, exakta testresultat och loggplatser, kvarvarande blockerare, förbrukad tid/kostnad om mätbar samt om några externa åtgärder gjorts. Lista nästa högst tre åtgärder. En kort rapport även om natten stoppades tidigt; inga procenttal eller påståenden om produktion/pilot.

## Kort uppdragstext för framtida godkänd start

**Codex:** Utför endast nästa uppgift i docs/EPIC_02_PLAN.md efter godkänd startgrind. Börja från godkänd Epic 01-bas i separat lokal branch. Bevara skrivregler, historiska migrationer och befintliga HTTP/MCP-kontrakt. Testa och committa små steg. Lämna fryst revision och testbevis till Grok vid de två granskningspunkterna. Följ nattens stoppgränser; ingen push/merge/deploy.

**Grok:** Granska den angivna frysta revisionen mot uppgiftens acceptanskriterier, i egen isolerad miljö. Reproducera relevanta fel och lämna en kort rapport med fynd-ID och bevis. Ändra inte produktkod, publicera inget och gör ingen ny demo vid fixgranskning. Skilj blockerare från backlogg. Om inga kriterier är brutna, godkänn steget utan att uppfinna fler krav.
