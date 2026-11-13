# Integritets- och säkerhetsprinciper

## MCP-kortets lokala bokningsprov

Separat opt-in, loopback-demodatabas, snäv SQL-roll och fast syntetisk kontakt;
inga admin-/registerverktyg. Individuell webbinloggning, domänvalidering,
kvoter, idempotens och överlappsskydd består. Bekräftelsefält och app-only
metadata ersätter inte autentisering eller verifierat mänskligt mandat.
Vid tappat skrivsvar får klienten inte anta att ingenting skapats. Samma
payload/nyckel på retry; efter stängt kort kontrolleras okänt utfall i admin
innan nytt försök. Läsroll/gammal profil bevaras. Production och VERCEL/VERCEL_ENV/VERCEL_URL nekas även
med opt-in. Andra ensamma plattformsmarkörer är inte alla kontrollerade (CB-QA-2). Ingen kundpilot eller mobil-/molnanslutning godkänns här.

## Manuell kunddata — godkänd avgränsning 2026-11-13

LC-QA-1: äldre e-postkvotnycklar var klartext. Nya icke-adminbokningar lagrar
nu HMAC-SHA256 med befintlig secret; kontaktåtgärden omkodar äldre råa nycklar
på sina kopplade bokningar. Övriga äldre rader ändras inte automatiskt.
Kvotfrågan räknar båda formaten; ingen budget återbetalas eller nyckel töms.
Detta är fortfarande pseudonymisering, inte full anonymisering.

Niclas har valt manuell export och bekräftad kontaktborttagning med teknisk
bokningshistorik kvar. Automatisk gallring är avstängd och ingen faktisk
lagringstid härleds från demodata. Endast syntetiska example.test-kort ingår.
Detta är tekniska byggdelar, inte pilotgodkännande eller ett automatiskt beslut
om hur en verklig begäran om tillgång/radering ska hanteras.

Kontaktborttagning ersätter de valda fälten i kortet och direktkopplade
bokningskopior; det är **inte full anonymisering**. ID, relationer, behandling/
tid, händelser, kvot-/idempotenshashar och backups kan fortfarande göra data
identifierbara. EU-kommissionen beskriver att återidentifierbara pseudonymiserade
uppgifter fortsatt omfattas av GDPR. [Primärkälla läst2026-11-13](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en).
IMY beskriver att radering kräver en bedömning och har undantag; POC:ns stopp
vid kommande besök ersätter ingen sådan rättslig prövning. [IMY](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/radering/).

Exporten avgränsas till kundkort/direktkopplade bokningar och kallas inte ett
fullständigt GDPR-registerutdrag. Ingen namn-/e-postmatchning på fristående
bokningar, massutlämning, kundexport-MCP eller publikt rättighets-API. Webben
kräver aktiv admin, samma origin, strikt schema och no-store. Själva åtgärds-
loggen innehåller enbart id/aktör/åtgärd/tid/antal och behöver egen framtida
retentionsbedömning. Den lagrar inte kontakter eller exportpayloads.

Före riktiga kunder återstår åtminstone: verksamhet/ändamål och lagringstider,
identifiering och manuell rättighetsprövning, relationen till eventuella journal-/
ekonomikrav, fristående bokningars identitetskoppling, logg-/hash-/backuplivscykel
och återläsning utan återinförda kontakter. Befintlig backup kan innehålla äldre
kontakter; operatören behöver hantera efterföljande kontaktåtgärder innan den
återställda miljön används. MFA/recovery, verkliga behörighets-/tenantgrindar,
leverantörskedja och kvarvarande auditfynd består som separata pilotkrav.

Tidigare avsnitt nedan är historik. Arkivering ensam är fortfarande inte
kontaktborttagning; den nya funktionen och dess begränsningar är uttryckliga.

## Kundmodulens demoavgränsning, Epic 06

Kundregister är inte ett GDPR-godkännande. Endast syntetiska uppgifter får
användas. Arkivering är åtkomst-/arbetsflödesstatus, inte radering/anonymisering.
Export, verklig radering, lagringstid och eventuell framtida kontaktvisning
utanför isolerad demo kräver separat arbete. Inga hälsoanteckningar införs.

Admin-/origin-kontroll, verksamhetsfilter och sammansatt FK skyddar kundlänken.
Aktör kontrolleras före replay. Klientens kund-ID är ett val, aldrig identitets-
bevis; ett publikt inmatat e-postvärde får varken slå upp, uppdatera eller koppla
kundkort. Rå example.test-kontakt är ett uttryckligt demo-undantag på kortet,
inte generell avmaskering av listor, bokningar eller MCP. API-fel/loggar ska vara
statiska och säkra enligt errors.ts. Bounded queries ersätter inte full framtida
tenant-isolering, MFA eller datalivscykel. Behåll befintlig previewperimeter.

## Undantag enbart för ägarens isolerade syntetiska demo

Niclas har uttryckligen godkänt att extra manuellt applösenord ersätts med en
demoknapp efter Vercels åtkomstskydd. Detta ändrar inte produktens normala
individuella admininloggning. Demovägen är av som standard och kräver Preview,
exakt projekt/databas, aktivt särskilt demokonto, origin-kontroll, wrapperns
adressbevis och befintlig loginspärr. Production nekas. Aktuell perimeter för
HTML, API, resurser och alla alias ska verifieras före aktivering, aldrig sänkas.

Grindflaggan pausar åtkomst men återkallar inte i sig alla cookies permanent:
en kopierad cookie från en session som inte loggats ut kan fungera när samma
miljö återaktiveras inom sessionens 8 timmar. Logout är permanent serverrevokering.
Använd befintlig kontospärr/credentialVersion eller ADMIN_SESSION_VERSION vid
permanent stopp. Vercels ändrade miljövariabler börjar gälla först i en ny deploy;
de ändrar inte en redan driftsatt instans. Inga hemligheter i klientkod eller URL.

Endast syntetisk data och redan godkänd ägare får finnas bakom denna förenkling.
Utökad åtkomst, kunddrift eller annan miljö kräver separat beslut. Aktuell
drift/stopp beskrivs i [DEMO](DEMO.md); kända låga begränsningar och testbevis i
[UI_USABILITY_REVIEW](UI_USABILITY_REVIEW.md) och [VERIFICATION](VERIFICATION.md).

## Tidigare skyddad Vercel-preview f2fdac7, 2026-11-12

Leverans f2fdac7 har verifierad all-deployment-perimeter, individuell appadmin,
TLS, headeröverskrivning/spärr, logout-revokering och beständighet vid kallstart.
Endast Niclas har åtkomst. Krypterad backup/återläsning är testad lokalt efter
driftprov, inte automatiserad eller offsite. Managed Neon har autentiserad
TLS-endpoint, inget verifierat privat nät. Vercelbuilden sker utanför EU medan
app/DB körs i Frankfurt. Inget av detta ersätter kunddriftens leverantörs-,
retentions-, licens- eller åtkomstbeslut. Fysisk iPhone/Safari återstår.

Niclas har uttryckligen godkänt den avgränsade anpassningen och skyddad syntetisk
preview, med några få dollar extra Vercelförbrukning men inga nya betalda
abonnemang/tillägg. Det är inte pilotgodkännande. All-deployment Vercel
Authentication och individuell appadmin krävs. Lämna inga publika undantag,
delningslänkar eller bypass-token till Grok. Läs aktuell status i DEMO/HANDOFF;
historiska formuleringar nedan om inget deploybeslut gäller den tidigare fasen.

Vercel-läget får bara köras bakom Vercels dokumenterade ingress. Behåll
socketmodellen för self-hosting; inför inte en generell headerfallback.
Gemensam PostgreSQL-spärr krävs på Vercel, utan fail-open eller memoryfallback.
Poolen för spärrar är separat från bokningstransaktioner. Tillfälliga
process-/plattformstester är inte bevis för produktionsklar flerinstansdrift.
Verifiera förfalskade headers, alla URL:ers skydd, sessioner/logout och
beständighet/återläsning i faktisk drift innan länken lämnas ut.

## Epic 05: mutationer och historik, kandidat under slutgranskning

Alla nya admin-API-mutationer ska kontrollera origin och aktiv serversession före payload eller idempotent replay. Härled aktör och businessId på servern; låt aldrig ett inskickat ID ensam ge rättighet. Versionskonflikt ska bevara originalet och kräva ny inläsning. Historiska bokningar ändras inte när tjänster redigeras; avbokning är status, inte radering. Direkt-DB-skydd för aktiva överlapp får inte ersättas av UI-kontroll.

BookingEvent och WorkspaceRequest tillför personanknuten spårbarhet och hashat idempotensunderlag. Logga inga råa payloads; håll resultatledger fri från kundnamn/e-post och hemligheter. Ingen produktionsretention för de nya raderna är beslutad. Framtida kund-/adminexport, gallring och säkerhetskopior måste omfatta dessa tabeller och snapshots. Schemat lagrar tider och ledighet, aldrig medicinska orsaker. Kalenderdata är potentiellt indirekt känslig även utan e-post. [Datakarta](DATA_FLOWS.md).

Lokal MCP-paritet är implementerad under slutverifiering. --allow-workspace är separat från --admin och äldre --allow-bookings; nya mutationer använder samma aktörs-/versions-/idempotens-/konfigurationslås och databasregler som webben. Varken flagga eller confirmed bevisar fjärrautentisering eller mänskligt samtycke. Agentläsningar utelämnar kundnamn/e-post; fullständig men begränsad personalkonfiguration är en uttrycklig administrativ läsning inför ersättande skrivning, inte allmän kalenderdata. Inga nya portar eller externa AI-mottagare. Privata previewgränsen måste skydda hela appen och API, inte enbart admin; inget deploybeslut finns. Pilot fortsatt NO-GO.

Verifierad admin får separat kontoanknuten bokningsbudget100/dag och60försök/15min, utan kundens IP-/e-posttak. Servern härleder aktören och kontrollerar aktivt konto igen före replay/skrivning. Publik väg och MCP behåller sina skydd även om en klient skickar actor-fält eller cookie. Detta är ingen MFA-/distribuerad limiterlösning; detaljregler och kvarvarande äldre kvotfält finns i ARCHITECTURE.

## Epic 04: kontobunden lokal åtkomst

Det delade adminlösenordet ersätts av individuella syntetiska konton, men MFA saknas fortfarande och pilot är NO-GO. Inget konto seedas som standard. Använd den lokala [operatörsguiden](ADMIN_OPERATIONS.md); lösenord får inte skrivas i argument, rapporter eller .env. Endast betrodd operatör med DB-/filsystemåtkomst får provisionera.

Argon2id via @node-rs/argon2 2.2.2, slumpmässigt salt, 19456KiB/t2/p1, 15–128 tecken. Bibliotekets verifiering används. Samma kostnad för okänt/inaktivt konto; samma generiska inloggningsfel. Reservation av fem klientförsök sker före await; högst fyra samtidigt pågående hashoperationer begränsar processens minnesarbete. Det senare kan kortvarigt ge429 för andra klienter och är ingen distribuerad kapacitetsgaranti.

Aktiv status, demo-kontext och serversession kontrolleras vid varje adminåtkomst. Versionskontroll under kontoradlås gör samtidig reset/login säker. Spärr/reset återkallar kontots samtliga sessioner; global ADMIN_SESSION_VERSION behålls. Återaktivering får inte återuppliva gamla sessioner. Kunduppgifter och MCP-kontrakt ändras inte. Att visa egen adminidentifierare är inte beslut om Visa kund-e-post.

Före pilot: underhållen MFA/återställning och identitetslivscykel, kundernas export/radering/retention, verifierad TLS/proxy/flerinstansdrift och licens-/auditgrindar. Ny nativebindning är lokalt testad på Windows och i Groks isolerade Linuxmiljö. Docker/container och komplett nativeartefaktinventering återstår; Linuxpaketet saknar egen LICENSE-fil enligt QA. Tidigare avsnitt om delat lösenord beskriver historiskt läge.


## Epic 03: beroenden och explicit konfiguration

Prisma 7.10.1 rättar den tidigare deepmerge-kedjan; full audit har preliminärt 7 moderate kvar i lintverktyg och produktionsaudit 0 fynd. Runtime/MCP autoläser inte längre .env via Prisma, men Node:s explicita env-flaggor och OS-/filåtkomst finns kvar. Detta löser ett specifikt konfigurationsbeteende, inte hela processisoleringsbehovet. Ingen ny mottagare eller behandling tillkommer. [Beroendegranskning, EPL-verktygsgräns och kvarvarande distributionskontroller](DEPENDENCY_REVIEW.md). Äldre Prisma 6-noteringar nedan är historik; pilot förblir NO-GO.

## Epic 02: lokal agentbokning och konfigurationsgräns

Endast --admin tillsammans med --allow-bookings aktiverar syntetisk MCP-bokning. Confirmed=true är klientens försäkran, inte bevis på mänskligt samtycke. Domänregler, kvoter och databasens skydd är gemensamma med HTTP; svaren minimeras. Det nya verktyget sanerar även schemafel via safeFailure utan att ändra äldre verktygs kontrakt.

Grok identifierade Prismas befintliga automatiska .env-inläsning (E02-QA-2): även en uttryckligt vitlistad subprocess-miljö kan få ADMIN_PASSWORD/SESSION_SECRET från projektkonfiguration vid Prisma-import. Att ta bort Node --env-file garanterar inte frånvaro av dessa värden. Ingen isolering påstås; detta är ett dokumenterat framtida driftarbete. Inga verktyg lämnar ut miljövärden, och bara syntetiska uppgifter får behandlas. Den explicita negativa serverstarten testas med tom hemlighet; Groks oberoende prob verifierade även helt saknad hemlighet utan sådan .env-konfiguration.

## Aktuellt efter QA batch 3

Fem fel från samma klient spärrar fortsatta lösenordskontroller, även för rätt lösenord. Samtidiga försök reserveras före jämförelsen; spärrade/felaktiga svar fördröjs minst 100 ms. Den tidigare beskrivningen om att rätt lösenord alltid släpps igenom är ett rättat säkerhetsfel, inte avsedd policy. NAT och IPv6-/64 delar skyddet; andra klienter påverkas inte. Processomstart, kapacitetseviktering och roterade nät är kvarvarande begränsningar.

Proxyfel ger en statisk engångsvarning utan personuppgifter. Korta proxy-prefix avvisas, men operatören måste fortfarande välja endast betrodda proxyadresser och verifiera faktisk TLS/proxy. Vid lyckad login gallras högst 100 utgångna/återkallade sessioner. ADMIN_SESSION_VERSION får bara höjas; sänkning kan återvalidera äldre cookies. Detta ersätter äldre påståenden om helt utebliven sessionsgallring. GDPR-livscykel, individuella konton, audit-fynd och maskerad e-post kvarstår som pilotfrågor. Ingen pilotgodkänd funktionalitet påstås.

## Aktuellt efter QA batch 2 — a84e48a

Den globala standardbucketen är borttagen. Riktig socketadress används, och forwarding kräver att socketen matchar konfigurerad proxy-IP/CIDR. Korrekt lösenord spärras inte av andra klienters fel. Separata sockets, förfalskade headers, klient-/e-posttak och eviction är testade. Verklig TLS-/reverse-proxydrift är fortfarande inte verifierad; en proxy måste överskriva klientens header och listan måste vara snäv. IP/NAT är inte individuell identitet och räknaren är processlokal.

Logout återkallar nu serverraden, även kopierade cookies nekas. Global versionshöjning kvarstår. Databasfel i sessionskontrollen nekar åtkomst med statisk fellogg. Konton/roller och automatisk sessionsgallring saknas. Detta ersätter tidigare beskrivningar av gemensam bucket och browserlogout längre ned.

Datakartan omfattar clientKey, emailCapKey och sessionshashar. Ingen GDPR-export, radering eller retention införs. Punkt 6 (Visa e-post) är uttryckligen undantagen. Audit, CSP unsafe-inline och obegränsad kampanjlista kvarstår. Testad POC innebär inte godkänd pilot; P0/P1-grindarna nedan består. Aktuella resultat: [VERIFICATION](VERIFICATION.md).

Senast granskad 2026-11-11. **POC:n är endast för syntetiska uppgifter och är inte klar för riktiga kunder eller kommersiell drift.** Detta är ett tekniskt underlag, inte ett bevis på GDPR-efterlevnad eller ett färdigt juridiskt beslut. Faktisk behandling måste bedömas med verksamhetens personuppgiftsansvariga och vid behov juridisk/dataskyddskompetens. Se [datakartan](DATA_FLOWS.md) för observerade flöden och osäkerheter.

## Principer för utveckling och drift

1. **Ändamål och minimering.** Definiera ändamål, mottagare och rättslig grund innan verkliga uppgifter behandlas. Samla bara in data som behövs för det ändamålet, begränsa fritext och svarsfält och lämna inte rutinmässigt ut kundlistor. Ingen journalfunktion eller avsiktlig hälsodatainsamling ingår i POC:n. Det är inte en garanti: en tjänst eller fri text tillsammans med identitet kan indirekt avslöja hälsa; klassificera utifrån sammanhang och stoppa sådan verklig behandling tills kraven utretts.
2. **Skydd som standard.** Offentliga och administrativa ytor ska hållas åtskilda. Extern åtkomst kräver lämplig autentisering, auktorisering, TLS, begränsning mot missbruk och granskning av loggning och cache. POC:ns delade lösenord, lokala MCP-adminflagga och Origin/Host-jämförelse är inte tillräckliga för en publik tjänst. Hemligheter ska hanteras utanför kod och loggar, med begränsad åtkomst och rotationsrutin.
3. **Gemensam domän och integritet i databasen.** Webb, API och framtida agenter ska använda samma validerade domänregler. PostgreSQL:s exclusion constraint och historiska migrationer ska bevaras; en tillgänglighetsförfrågan ersätter inte integritetsskydd vid samtidighet. Kontrollerna hindrar inte obehörig läsning.
4. **Isolering före flera verksamheter.** Bind framtida verksamhetskontext till verifierad identitet på serversidan. Varje läsning, skrivning, relation, cache, logg, export, backup och MCP-resultat ska omfattas; identifierare från klienten får aldrig ensamma ge behörighet. Lägg databasintegritet för verksamhetskopplade relationer och negativa korsverksamhetstester där det passar. `businessId = demo` och dagens utländska nycklar är inte isolering. Tillåt inte delad flerföretagsdrift innan detta är bevisat.
5. **Agent-native med minsta privilegium.** MCP över stdio betyder inte att en ansluten agent eller dess leverantör är betrodd. Definiera vem som får starta processen och använda verktygen, vilka fält och tidsintervall som behövs, och vilka mottagare och underbiträden som hanterar resultat. Skicka inte namn, e-post, bokningslistor, hemligheter eller hälsorelaterade data till extern modell utan en specifik dokumenterad ändamåls-, behörighets-, avtal- och överföringsbedömning. Skydda mot prompt injection och behandla agentoutput som opålitligt förslag. Kampanjer ska fortsatt granskas av människa före publicering; granskaren kontrollerar också personuppgifter och innehåll.
6. **Loggar, cache och fel.** Undvik personuppgifter, lösenord, cookies, token, databas-URL, request-/response-body och fulla bokningar i loggar, traces, verktygssvar och felrapporter när de inte behövs. Epic 01 ersätter rå felloggning vid HTTP/MCP/databasladdning i sidor med statisk loggkod och generiska oväntade fel. Domänfel får bara godkända statiska meddelanden. Regressionstester täcker syntetiska hemligheter och verkliga MCP-anslutningsfel; detta omfattar inte all ramverks- eller infrastrukturloggning. Tillämpa minsta nödvändiga, redigering, åtkomstkontroll och gallring även på databas-/proxyloggar, supportkopior, cache, skärmbilder och backup. Testa att adminsvar inte delas eller cachelagras felaktigt i faktisk driftmiljö.
7. **Livscykel och rättigheter.** Bestäm och dokumentera lagringstid per ändamål efter faktisk rättslig och verksamhetsmässig bedömning; inför kontrollerbar radering/återställning och hantering av begäranden om tillgång, rättelse, radering m.m. med relevanta undantag. Inkludera loggar och säkerhetskopior samt verifiera återläsning och hur radering får genomslag efter återställning. POC:n har ingen sådan funktion eller policy idag.
8. **EU/EES och self-hosting.** EU/EES som mål för värd, databas, loggar och backup kräver dokumenterad leverantörskedja, regioner, supportåtkomst och avtal. Lagring inom EU/EES i sig bevisar inte att all åtkomst eller behandling sker där eller löser alla tredjelandsfrågor. Bedöm överföringar och skyddsåtgärder individuellt när det behövs. Self-hosting ger operatören kontroll men inte automatisk efterlevnad; tillhandahåll lokala, transparenta konfigurations- och telemetrialternativ. Se [EDPB om internationella överföringar](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en).
9. **Verifiera i stället för att anta.** Använd bara syntetiska uppgifter i tester, exempel, prompts och buggrapporter. Granska dependencies och eventuella transitive utgående anrop; kontrollera opt-out före CLI-/byggprocesser och verifiera med nätverksobservation i en isolerad testmiljö. En statisk sökning är inte en garanti. Inga nya beroenden eller externa integrationer utan faktisk behovs-, licens- och säkerhetsbedömning.

[EDPB:s principer för inbyggt dataskydd](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en) och [säkerhet för personuppgifter](https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en) ger ytterligare vägledning. Val av rättslig grund och eventuell tillämplighet av artikel 9 ska beslutas för den konkreta behandlingen; generellt samtycke eller avtalsgrund får inte antas lösa varje situation.

## Prioriterade grindar

### P0 — före några riktiga kunduppgifter, inklusive pilot

- [ ] **Klassificera tjänster och datainnehåll.** Avgör om uppgifterna i sammanhanget kan vara hälsouppgifter; avgränsa eller stoppa sådana flöden tills nödvändiga rättsliga och tekniska skydd är beslutade. Inga journaler ska tillkomma under denna POC.
- [ ] **Stäng läckagevägar.** Inför och verifiera autentisering/auktorisering för administrativa data, åtkomstskydd för värd och databas, TLS i transport, säker konfiguration, begränsning mot gissning och otillåten åtkomst, samt cachekontroll. Granska den publika bokningsvägen för missbruk och indatahantering. Säkerställ att tillfälliga utvecklingsservrar och debugfunktioner inte exponeras.
- [ ] **Avgränsa MCP.** Håll endast betrodd lokal anslutning eller stäng av adminverktyg; skicka inte kunddata till externa agenter innan faktisk identitet, begränsningar, mottagare och avtal/överföringsbedömning är klara. `list_bookings` är nu begränsat per datum och sida och utelämnar kundnamn/e-post, men dess ID, tider och tjänster kan fortfarande vara personuppgifter; paginering hindrar inte en behörig lokal klient från att göra flera anrop.
- [ ] **Sanera loggar och dataflöden.** Applikationens granskade felgränser har sanerats i Epic 01. Verifiera dessutom faktisk databas-, proxy-, agent-, ramverks- och övervakningsloggning. Dokumentera lagringsställen, rättigheter och initiala gallrings- och backuprutiner. Säkerställ separata test- och driftmiljöer.
- [ ] **Fastställ ansvar och laglig behandling.** Dokumentera ändamål, kategorier, rättslig grund, ansvarig/biträde, avtal där det behövs, information till registrerade, rutiner för rättigheter och incidenter samt behov av konsekvensbedömning. Detta ska granskas för den konkreta driften, inte antas utifrån POC:n.
- [ ] **Besluta leverantörer och regioner.** Kartlägg verkliga nätverksanrop, databas, hosting, backup, loggar, support och AI-klient; bedöm EU/EES, eventuell tredjelandsåtkomst och underbiträden innan uppgifter lämnar miljön.

### P1 — före kommersiell lansering

- [ ] **Verifiera och dokumentera drift och säkerhet** med hotmodell, oberoende granskning, uppdaterings-/sårbarhetsprocess, penetrations- och återställningstester, behörighetsrevision samt incidentövning. Åtgärda eller formellt riskbedöm de dokumenterade beroendevarningarna.
- [ ] **Färdigställ datalivscykeln** med dokumenterade tider, mekanismer och tester för radering, rättigheter, backuper och återläsning. Säkerställ hantering av drift-/supportkopior och att registrerade får korrekt information.
- [ ] **Slutför organisations- och leverantörsunderlag** inklusive tillämpliga biträdesavtal, underbiträdeslista, faktisk driftregion, överföringsmekanism och bedömning där relevant. Bedöm behovet av DPIA och dokumentera slutsatsen. Incidentprocessen ska möjliggöra anmälan inom tillämplig tidsfrist; registrerade och myndighet informeras när kraven är uppfyllda. Se [EDPB om personuppgiftsincidenter](https://www.edpb.europa.eu/topics/security-data-breaches/personal-data-breaches_en).
- [ ] **Verifiera självhosting och EU/EES-alternativ** inklusive installation, konfigurationshemligheter, opt-out för verktygstelemetri, egressinventering, backup/återställning och uppdateringar. Docker Compose har inte verifierats på denna värd.
- [ ] **Före delad flerföretagsdrift:** implementera och testa autentiserad verksamhetskontext och negativ isolering över webb, API, databas, cache, jobb, loggar, exporter, backup och MCP. Kommersiell lansering av en separat installation per kund eliminerar inte behovet av åtkomst- och driftkontroller.

## Verifieringsgräns

Granskningen omfattade lokala projektfiler, migration/schema, npm-manifestet, projektets logg- och nätverksanrop samt lokal Next-telemetristatus. Den inkluderade inte fullständig kodrevision av alla tredjepartspaket, aktivt intrångstest, kontroll av faktisk drift, avtal eller mätning av utgående trafik. Inga produktionsuppgifter eller hemligheter behövdes. Tidigare testresultat finns i [VERIFICATION.md](VERIFICATION.md).

## Verifierade förbättringar i Epic 01 QA-batchen

Datum 2026-11-11, kod 26ea617. Processlokal rate limit, transaktionssäkrat dagstak, browserlogout/global versionsåterkallelse, avgränsad adminlista/maskerad e-post, testdatabasgrind och säkerhetsheaders är testade enligt [VERIFICATION](VERIFICATION.md). Detta slutför inte P0-/P1-grindarna ovan.

TRUST_PROXY_IP får bara aktiveras bakom en proxy som överskriver X-Real-IP och förhindrar direktåtkomst. Utan detta används gemensam konservativ bucket. In-process-räknaren skyddar inte flera processer eller omstarter. E-posttak bevisar inte kundidentitet. Höj aldrig tillbaka ADMIN_SESSION_VERSION; starta om alla instanser för global återkallelse. Logout stoppar inte en redan kopierad cookie individuellt.

CSP tillåter unsafe-inline; admin no-store och HSTS-header är testade, men verklig TLS/proxy och webbläsarens HSTS-beteende är inte verifierade. IP-minne, skapandetid och idempotenshash behöver ingå i framtida lagrings-/gallringsbeslut. Inga nya externa tjänster eller npm-beroenden har lagts till. Audit och binärlicenskrav kvarstår; se [tredjepartsnotiser](../THIRD_PARTY_NOTICES.md).
