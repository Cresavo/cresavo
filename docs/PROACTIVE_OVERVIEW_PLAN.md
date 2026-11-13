# Nattmål 2026-11-13: proaktiv arbetsöversikt

Godkänt mandat: Del A i Niclas paket booking-lab-codex-nattmal-2026-11-13.md.
Del B bevaras i [research](research/BOOKING_LAB_DIRECTION_2026_11_13.md), med
ursprungliga datum/källor. Det är levererat researchunderlag, inte nya egna
leverantörstester eller en verifiering av samtliga externa uppgifter.

Bas: ren28a48fe efter avslutat kalenderprov; produktkod7c1407d, tidigare
Grok-/CI-bevis i HANDOFF. Branch feature/proactive-capacity-overview. Ingen
pågående tidigare QA. Äldre main används inte. Codex ensam skrivare, befintlig
Grok granskar fryst revision i separat syntetisk kopia, högst två fixvarv.

## Inventering före implementation

| Område | Status och faktiskt underlag |
| --- | --- |
| Bokning/kalender, flytt/avbokning, personal/schema, konflikt/retry | Finns: domain.ts, booking-mutations.ts, workspace-config.ts, Epic05/06-verifiering. |
| Kundkort/historik och syntetisk demo | Finns: customers.ts, scripts/seed-demo.ts, verifierad Epic06. GDPR-livscykel saknas. |
| Kampanj | Delvis: domain.ts campaignSchema/createCampaign/publishCampaign, /admin/campaigns; tjänst+datumintervall, ingen exklusiv lucka eller automatisk prisdebitering. |
| Lokal agentåtkomst | Finns: src/mcp/server.ts och workspace.ts; separata betrodda opt-in-flaggor. Direkt läsprov verifierat. Ingen publik fjärrautentisering. |
| Proaktiv upptäckt och varaktiga förslagsbeslut | Saknas före detta mål. |
| Journal, lager/inköp, betalning/kassa/presentkort, bokföring, social publicering, kommersiell analys | Planerat. Verksamhetstyp, behörigheter, regelkrav, leverantörer och avtal behöver beslut. |
| Inbyggd AI/inkluderad användning, egen assistent, egna API-nycklar | Produktinriktning beslutad; priser/kvoter/leverantörer/implementation återstår. Nattens regelbaserade signal kräver ingen modell. |

## Avgränsning och acceptans

1. Lista få framtida avbokade tider inom högst sju lokala kalenderdagar som
   fortfarande kan bokas enligt getAvailability. Visa tjänst, utförare, tid,
   orsak, aktualitet och hämttid; aldrig kunduppgifter eller intäktsprognos.
2. Stabil källa är bokningens id+avbokade version. Ett separat litet beslut
   lagrar avfärdande eller utkastkoppling; omladdning återskapar inte beslut.
   Ändrade scheman/tjänster, ny bokning och passerad tid kontrolleras på nytt.
3. Ny /admin/overview bevarar /admin som kalender. Öppna rätt kalenderdag,
   avfärda eller förhandsgranska och spara ett verkligt kampanjutkast. Tomt,
   laddning, fel och inaktuell källa har tydlig väg vidare på mobil/desktop.
4. Rabatt väljs uttryckligen, inget automatiskt erbjudande. Befintlig modell
   kräver1–100%; tjänst/datumintervall visas som faktisk omfattning, för alla
   bokningsbara tider/utförare för tjänsten. Utkast reserverar ingen tid,
   publiceras inte och skickar ingenting externt.
5. UI/API/lokal MCP anropar samma domän. Aktör före replay, strikt validering,
   origin på webbskrivningar, begränsade svar. Endast betrodd lokal
   --admin --allow-workspace får utkastshandlingen. Ingen ny fjärråtkomst.
6. Samma förslag får högst ett utkast även med olika nycklar/aktörer och20
   samtidiga anrop. Samma request med ändrade villkor nekas. Atomicitet för
   kampanj+koppling, konfliktskyddet för bokningar ligger kvar.
7. Additiv scenarioseed visar ledig avbokning, återbokad avbokning och
   avfärdande/utkast. Bevara äldre snapshots och manuella data; seed körs
   uttryckligen med Stockholmsrelativa datum, inte automatiskt varje dag.

## Tekniska förslag, inte nya produktbeslut

Beräkna vid läsning/uppdatering, ingen scheduler/workflowmotor. Använd befintlig
konfigurationslåsning, aktörsbunden workspaceWrite-ledger och resurslås före
kontroll/handling. Minimal additiv beslutstabell och en kampanjkoppling med
unik källidentitet. Endast hashad underlagsversion och nödvändiga referenser,
inga kopierade kundfält. Efterhandling visar både faktiskt beslut och aktuell
kapacitet, så ett sparat utkast aldrig framstår som en reserverad tid.

## Verifiering och leveransgrind

Ny separat loopback_test: generate/migrate/seed, lint/tsc/unit/integration,
build och projektets fyra E2E-lägen; meningsfulla negativa/stale/retry/
samtidighets-/MCP-prov och uppgraderings-/återseedbevis. Audit separat, inga
risky overrides. Verkliga mobilstorleks-/desktopklick och riktade bilder.
Fryst kodcommit och rensad ZIP till Grok, inga env/hemligheter. Högst två
samlande fixvarv, därefter tydlig blockerare om kvarstående allvarliga fel.
Normal privat push först efter grinden, Actions på exakt SHA. Samma skyddade
preview får därefter uppdateras med verifierad perimeter/revision och backup
före migration inom tidigare kostnadsram. Annars lokal provväg och deployment
väntande. Ingen mainmerge/force-push, publik MCP, nya betaltjänster eller pilot.
Uppdatera befintlig status/handoff/verifiering/produktägarrapport och avsluta
målet. Starta inga ytterligare epics automatiskt.

## Implementerad provväg (slutverifiering pågår)

Efter befintliga lokala startsteg och migrering av en separat loopback *_demo:

```powershell
$env:BOOKING_DEMO_SEED = "1"
npm run demo:seed:capacity
npm run build
npm run start
```

Använd befintlig individuell lokal admininloggning; seed skapar inte ett känt
publikt applösenord. Previewns befintliga demoknapp är endast tillåten i den
pinnade skyddade Vercel-miljön, aldrig som lokal/publik bypass.

1. Öppna **Översikt** i administrationen. Seedens Sam Demo har nästa vardag
   09.00 en bokningsbar avbokning;10.00 är återbokad,11.00 redan avfärdad och
   13.00 har ett verkligt opublicerat10%-utkast. Datum räknas vid körning.
2. **Öppna kalendern** ska visa samma dag och medarbetare. Kalendern är kvar
   på /admin; översikten är en separat tydlig ingång, inte en ersättning.
3. På09-förslaget: välj **Förbered kampanjutkast**, en egen rabatt och giltiga
   datum, förhandsgranska den verkliga omfattningen och spara. Ladda om;
   länken ska gå till samma utkast i den befintliga kampanjvyn.
4. Boka den tiden i kalendern. Uppdatera översikten; utkastet finns kvar men
   tiden visas som inaktuell. Publicera ingenting för detta prov.
5. Skapa/avboka en annan egen syntetisk bokning och avfärda dess förslag.
   Omladdning ska behålla beslutet. Tiden är fortfarande tillgänglig för bokning.

Seedningen är uttrycklig/additiv. Redan ändrade eller upptagna seedtider
rapporteras som skipped; inga manuella uppgifter återställs. Se faktisk
VERIFICATION innan provvägen kallas slutverifierad eller driftsatt.

Kontrakt: GET /api/admin/capacity tar optional from/days/limit, max7dagar inom
idag..idag+7, max20källor; gränserna tolkas i Stockholm. POST tar action och
input, där källa är bookingId/sourceVersion/expectedToken. Calendar och preview
läser; dismiss och draft kräver Idempotency-Key. Draft/preview tar dessutom
campaign med befintliga serviceId/title/discountPercent/validFrom/validUntil.
Alla webbanrop kräver admin, POST även samma origin. Token är underlagsversion,
inte autentisering, reservation eller garanti om framtida tillgänglighet.

Agentprovet är ett verkligt SDK-kontraktstest med befintlig lokal stdio:
`npm run test:integration -- tests/integration/capacity.test.ts`. Läsverktygen
kräver --admin, de två nya skrivverktygen även --allow-workspace. Default-
serverns två läsverktyg och direktklientens kalendersekretess förblir oförändrade.
Detta är ingen ny Dots/Muse-/fjärrintegration.
