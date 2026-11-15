# Agentprov 1 · godkänt nattuppdrag 15 november 2026

Bas bf7b6c3507fd68503b9e797dce55e71f87e8bd1c, feat/agent-availability-api-v1.
Separat lokal branch codex/agentprov-1. READ-WRITE uttryckligen valt.
Ingen push, PR, merge, rebase, deploy, kontoskapande eller secret-provisionering.
Inga lokala .env-filer eller Docker. Bara syntetiska uppgifter och example.test.

## Leveransgräns

Gateway-kontrakt före kosmetik. Befintlig REST /api/v1, HTTP-MCP /api/v1/mcp,
bokningsstatus och /live återanvänds. Behåll startsida, nödvändig admin,
säkerhetskontroller, konfigurationslås, kvoter och databasens överlappsskydd.
Agentvägen skapar inte kundkort men lagrar fortfarande namn/e-post i bokningen;
detta är dataminimering, inte anonymitet eller färdig GDPR-hantering.

## Minsta kontraktsrättning

- Stabil klientidentitet separat från credentials. Rotation återkallar gammal
  nyckel och behåller bokningsägarskap och idempotensnamespace. Ingen klient
  får välja eller byta identitet via anropspayload.
- Serverlagrat, återkallningsbart engångsmandat bundet till klient/verksamhet,
  tjänst, utförare, tidsintervall och maxpris i SEK. Ursprung registreras som
  syntetiskt operatörsgodkännande, utfärdat utanför agent-API:t. confirmed=true
  kvarstår bara som kompatibilitetsfält och räcker aldrig för att skapa mandat.
  Detta bevisar inte en verklig kunds samtycke; skarp kundidentitet/mandat är senare.
- Bokning, händelse, mandatförbrukning och AgentBooking-koppling committar eller
  rullas tillbaka tillsammans. Kontrollera aktuell credential/klient i transaktionen.
  Retry av befintligt utfall kontrollerar rätt klient, payload och ursprungligt mandat.
- /live benämns filtrerat syntetiskt best-effort-flöde. Booking-id och status är
  auktoritativa svar, inte leverans av en live-händelse. Ingen rå logg eller PII.

## Acceptans och faktisk evidens

Körbar plan och testkod för två separata transportklienter: riktig MCP SDK-klient
över HTTP och fristående REST-script. Skilj transporttest från verifierad körning
av en personlig assistent; namn eller proveniensflagga bevisar inte kompatibilitet.

Testa skapande/id/status, identisk retry, samtidiga överlapp med en vinnare,
BOLA mellan klienter och verksamheter inklusive replay, nyckelrotation/revocation,
mandatgränser, manipulerat/utgånget/återkallat mandat och atomisk rollback.
Inga tidsgränser/assertions sänks för grönt. Lint, tsc och unit körs.
Riktig integration körs bara med verifierad loopback *_test eller *_demo och
befintlig testdatabasvakt. Cloud-DB får aldrig passera som integrationsdatabas.

## Driftförberedelse och städning

Dokumentera Vercel/Neon, enbart variabelnamn, migrations-/seedsteg och checks.
Inget exekveras i molnet utan nytt driftgodkännande. Inga konton eller secrets.
Städning först efter godkända tester och separat commit/park/legacy; inga
historiska migrationer eller gemensamma lås flyttas. Vid ej verifierad regression
förblir äldre moduler på plats. Befintlig scenfil får tas bort först efter referenssökning.

## Windows-policyn hålls separat

b241d8a / a101704 ligger på sidogren feature/shared-booking-policy, inte i denna
bas. Ingen blind rebase/cherry-pick. Konfliktytor är domain.ts, schedule.ts,
schema/migrationsordning, lokal MCP workspace och publika bokningsformulär.
Agentmandatet får inte framställas som införande av den saknade delade policyn.

Svenska looprapporter på denna Windows-körning: <local-scratch>/night-NN.md.

## Avgränsad städning och kvarvarande parkering

`park/legacy` bevarar bf7b6c3507fd68503b9e797dce55e71f87e8bd1c lokalt.
Den oanvända `src/app/product/scene.tsx` saknar importer och tas bort separat
efter godkänd kontraktsmatris. README:s aktuella API-del ersätter gamla exempel
som saknade mandat; historiska resultat behålls och märks som historik.

Bred modulbortkoppling är **inte genomförd**: adminbokningens editor importerar
fortfarande customers/picker och länkar kundkort; domänens customerId-koppling,
kontaktborttagningsskydd och workspace-write används även av nödvändig admin.
Lokal MCP delar dessutom schemas/importer för kampanj/kapacitet och kortlägen.
Att flytta katalogerna direkt skulle bryta befintliga ingångar och tester.
Snapshotbranchen betyder därför inte att modulerna är borttagna ur arbetsgrenen.

Nästa separata städuppgift är att koppla loss UI/adapteringångarna en grupp åt
gången och verifiera nödvändig admin/startsida innan borttagning. Inga lås,
historiska migrationer, skydd eller tester har tagits bort för att få grönt.
Agentprov 1 är körbart utan den större städningen; den redovisas som återstående.
