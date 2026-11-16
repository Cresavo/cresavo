# Agentbokning som följer med och ägarens arbetsdag

Godkänt av Niclas 2026-11-13 genom ”Kör denna” efter goal-prompten i chatten.
Bas e702838 (produkt8126410), separat feature/agent-booking-workday. Codex är
ensam skrivare. Gamla profiler, bokningar och historiska migrationer bevaras.

Status2026-11-13: levererad lokal syntetisk POC på05e5eaf, samma revision har
Groks slutligaGO och fyra gröna Actionsjobb43467138367. Två rättningsvarv är
använda; inga fler automatiskt.91unit/125integration/13kort och48webb×4 PASS,
med bevarade lokala dev-fel/cacheåterställning enligt VERIFICATION. Privat
plugin0.3.0 och lokal webb/ägarprofil aktiverade med bevarade gamla bokningar.
Native-klick, hot-reload, fysisk mobil och kalenderimport NOT RUN. Ingen ny drift.
Originalslutrapport: qa/QA-REPORT-agent-workday-f2-05e5eaf.md.

## Avgränsade leveranser och acceptans

A. Beständig, lokal syntetisk försökslogg avgränsad till befintlig betrodd
MCP-bokningskanal. Kortets omöppning återläser aktuellt kvitto eller samma
okända försök. Idempotensnyckel/payload består även efter processomstart.
Ett id eller e-post räcker aldrig för återläsning. Inga verkliga kundidentiteter.
Kalenderfil har UTC-instanter, korrekt behandlingslängd (utan intern buffert),
stabil UID, escaping och tydlig information om utebliven automatisk synk.

B. Separat opt-in, lokal ägarprofil med --admin, giltig SESSION_SECRET och
loopback \*\_test/\_demo. Ett läsande arbetsdagskort återanvänder kalender,
tillgänglighet och kapacitetsförslag. Inga kontaktuppgifter, nya mutationer
eller automatiska uppgraderingar av kundkortets rättigheter. Begränsad
paginering och tydliga länkar till vanlig skyddad admin; inga hemligheter i URL.

C. Begripliga tillstånd, fokus/tangentbord och 320/390/1024-presentation.
Skilj testvärd från native-PC och fysisk mobil. Ingen ny tunnel, fjärr-MCP,
ny kostnad eller publik åtkomst. Mobilanslutningen blockeras separat om den
kräver nytt drift-/åtkomstbeslut; övrigt arbete fortsätter.

## Genomförande och grindar

- Liten additiv migration tillåten för konkret försökslogg. Ingen ändring av
  createBooking, historiska migrationer, exclusion, budgetar eller adminauth.
- Riktade negativa tester: behörighet, fel scope, stängt kort/processomstart,
  okänt utfall, dubbeltryck/parallella retries, ändrad/avbokad bokning, ICS/DST.
- Ny isolerad slutmatris: npmci, generate/migrate/seed, lint, tsc, unit,
  integration, korttester, build, fyra webb-E2E-lägen; audit separat.
- Fryst Grok-granskning i separat syntetisk kopia, högst två samlade fixvarv.
  Grok får inga hemligheter, originalredigering eller driftåtkomst.
- Efter verifiering/QA: privat push, exakt SHA/Actions. Ingen mainmerge,
  force-push eller automatisk nästa epic. Bara befintlig redan godkänd preview
  får uppdateras om dess skydd och funktion verkligen berörs; lokal MCP blir
  inte mobilansluten genom webbdeploy.

## Status vid start

### Samlat rättningsvarv 1 efter första Grok-granskningen

Grok ger scopedGO på c4e08bd med4Low/6Info. AW-QA-1/2 strider dock mot målets
uttryckliga profilgräns: ett samtidigt globalt domänreplay kunde lämna annan
kanals kvitto eller permanent låsa ett pending-försök. Codex rättar därför
just dessa två inom samma mål, inte ett omtag av epics eller all Low-backlogg.
Admission tar befintligt globalt idempotenslås före kanallåset och kontrollerar
UUID-claim. Efter createBooking verifieras även faktisk clientKey, och en
förbrukad främmande nyckel markerar eget pending failed i en committad
transaktion innan403. Ingen ändring av domänkärna, kontrakt eller migrationer.
Fyra deterministiska PostgreSQL-/MCP-regressioner håller/släpper verkliga lås
och täcker samtidigt replay, oavslutat försök samt äldre icke-kortkanal.
F1 cf6d2d2 har Grok scopedGO: båda fynden stängda, 89 unit/124 integration,
13 korttester och 46 webbtester i alla fyra lägen även hos Grok. Originalrapport:
`qa/QA-REPORT-agent-workday-f1-cf6d2d2.md`. Övriga Low/Info är backlogg.

### Samlat rättningsvarv 2 (sista) — omvänd replaygräns

AW-F1-QA-1 är Low men berör samma uttryckliga profilkrav: äldre MCP eller publik
HTTP kunde få kortets bokningssvar genom exakt känd nyckel/payload. Den lilla
rättningen kontrollerar därför den faktiska returnerade radens kanal innan
svaret lämnar dessa ingångar, bara för kortets `time-card_`-prefix. Kontrollen
sker efter domäntransaktionen och täcker även samtidiga replays. Samma lokala
hemlighet och MCP-identitet är avsiktligt samma betrodda demokanal, inte olika
personer. Andra nycklars kontrakt, administratörens redan separata namespace,
domänens regler/lås och alla migrationer lämnas oförändrade. Inga äldre tester
tas bort eller sänks. Nya tester omfattar parallella nekade replays från äldre
MCP och verklig HTTP samt positivt replay från rätt kanal.

Ingen tredje rättningsloop. Blockerande fel efter denna granskning redovisas
som blockerade; mindre kvarvarande förbättringar stannar i backloggen.

Ren arbetskopia och rätt föregångare verifierade. Föregående Grok/CI gäller
8126410, inte den nya implementationen. Befintlig Vercel-preview är oförändrad.
Inga nya npm-beroenden planeras. Resultat förs till befintliga status-/handoff-
och verifieringsdokument när de finns; inget nytt godkännande antas.
