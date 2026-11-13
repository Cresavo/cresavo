# Agentbokning som följer med och ägarens arbetsdag

Godkänt av Niclas 2026-11-13 genom ”Kör denna” efter goal-prompten i chatten.
Bas e702838 (produkt8126410), separat feature/agent-booking-workday. Codex är
ensam skrivare. Gamla profiler, bokningar och historiska migrationer bevaras.

## Avgränsade leveranser och acceptans

A. Beständig, lokal syntetisk försökslogg avgränsad till befintlig betrodd
MCP-bokningskanal. Kortets omöppning återläser aktuellt kvitto eller samma
okända försök. Idempotensnyckel/payload består även efter processomstart.
Ett id eller e-post räcker aldrig för återläsning. Inga verkliga kundidentiteter.
Kalenderfil har UTC-instanter, korrekt behandlingslängd (utan intern buffert),
stabil UID, escaping och tydlig information om utebliven automatisk synk.

B. Separat opt-in, lokal ägarprofil med --admin, giltig SESSION_SECRET och
loopback *_test/_demo. Ett läsande arbetsdagskort återanvänder kalender,
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
Övriga Low/Info är backlogg. Slutmatris och riktad Grok-återkontroll återstår.

Ren arbetskopia och rätt föregångare verifierade. Föregående Grok/CI gäller
8126410, inte den nya implementationen. Befintlig Vercel-preview är oförändrad.
Inga nya npm-beroenden planeras. Resultat förs till befintliga status-/handoff-
och verifieringsdokument när de finns; inget nytt godkännande antas.
