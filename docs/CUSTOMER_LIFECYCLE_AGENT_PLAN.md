# Kunddatas livscykel och nästa lokala agentprov, 2026-11-13

Niclas har godkänt steg2–3 i samtalet och därefter uttryckligen valt manuell
export/kontaktborttagning med teknisk historik kvar, automatisk gallring av.
Bas ren d2ccb6c efter levererad8843d06; separat branch
feature/customer-lifecycle-agent-proof. Kalenderprovet/nattmålet görs inte om.

## Två avgränsade delar

1. Admin kan exportera ett syntetiskt kundkort och dess uttryckligen kopplade
   bokningar, högst100per fil med fortsättning och max1000totalt. Ingen e-postmatchning, bulkexport,
   kontakt-MCP eller exporter av hemligheter/andra kunder. POST/origin/admin,
   no-store, statiskt filnamn och minimal åtgärdslogg utan kontaktfält.
2. Admin förhandsgranskar och bekräftar borttagning av namn/e-post/telefon på
   kortet samt kontaktkopior i direktkopplade bokningar. Tid/pris/status,
   bokningsversion för verksamhetsändringar, händelser, beslut och konflikt-
   skydd bevaras. Separata tidsmarkörer visar kontaktåtgärden. Kortet arkiveras
   och kan inte återaktiveras/redigeras eller användas för nya bokningar.
3. Säker POC-gräns: endast example.test, max1000kopplade bokningar per manuell
   åtgärd, ingen borttagning medan kommande aktiva besök finns. Det är ett
   tekniskt POC-skydd, inte en bedömning av ett rättighetsärende för kunddrift.
   Förhandsgranskningens version/token kontrolleras igen; retries/samtidighet
   ger högst en kontaktåtgärd. Befintligt konfigurationslås gör åtgärden atomär
   mot skapa/redigera/flytta/avboka. Ingen generell lås-/workflowmotor.
4. Därefter provar en ägarassistent befintlig lokal kapacitets-MCP: läs förslag,
   uttryckliga kampanjvillkor/mandat, förbered ett enda utkast, följ status och
   nekat inaktuellt underlag. Återanvänd Codex här om anslutningen kan exponera
   den avgränsade befintliga kapacitetsvägen. Ingen publik MCP eller modellnyckel.
   En CLI-/SDK-kontroll räknas inte som ett bevis för en faktisk AI-klient.
   Om omladdning/klientåtkomst behövs dokumenteras just det hindret; övrigt
   slutförs självständigt. Ingen påhittad ChatGPT/Grok/Dots/Muse-integration.

## Begränsningar och beslut

Kontaktborttagning är inte full anonymisering: ID, behandling/tider, relationer,
hashade idempotens-/kvotnycklar, säkerhetsloggar och backups kan fortfarande
vara personrelaterade. Exporten är ett uttryckligt urval av kort/bokningar,
inte ett påstående om fullständigt registerutdrag enligt GDPR. Oanknutna
bokningar matchas aldrig automatiskt på namn/e-post. Nedladdade filer, fria
kampanjrubriker och externa driftloggar omfattas inte av denna manuella åtgärd.
Ingen automatisk gallring eller påhittad lagringstid. Återläsning av äldre
backup kräver operatörshantering av kontaktåtgärder före ny åtkomst; ingen
permanent juridisk radering eller backupgallring påstås.

Primärkällor lästa2026-11-13: [EU-kommissionen om identifierbarhet/anonymisering](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en)
och [IMY om radering och undantag](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/radering/).
De är rättslig bakgrund; ovanstående tekniska POC-val är våra avgränsningar,
inte ett juridiskt godkännande. Verklig lagringstid, rättighetsprövning och
leverantörs-/backupkedja återstår före kundpilot.

## Acceptans och leverans

- Export har rätt kund och korrekt paginering även över100bokningar; andra
  kunder, sessionsdata, kvot-/idempotensnycklar och råa serverfel följer inte med.
- Obehörig, foreign origin, fel kund/verksamhet, okänt fält, gammal version/token
  och för stort underlag nekas. Lokal MCP får inte kundexport/kontaktborttagning.
- Bekräftad åtgärd rensar kontaktkopior, bevarar teknisk historik och källbeslut;
  gamla replays eller samtidiga kundändringar återinför inte kontaktuppgifter.
- Samma nyckel/20samtidiga försök ger en åtgärd/loggrad; ändrad payload409.
  Detta gäller kontaktborttagning. Exportdelar loggar varje förberedelse, inte
  en påstådd eller idempotent filöverföring till en kund.
- Export/kontaktborttagning kan provas i faktisk mobil-/desktopbrowser med egen
  ny syntetisk kund; inga äldre demokunder rensas automatiskt.
- Agentprovet redovisar verklig klient, mandat, revision, faktiskt verktygsanrop,
  beständigt utkast, nej/avbryt och inaktuellt underlag separat från kontraktstest.
- Ny additiv migration, historiska8oförändrade; upgrade/återseed bevarar äldre
  data. Inga nya beroenden, betaltjänster eller stora ramverk.
- Meningsfulla unit/integration, lint/tsc/build och4E2E-lägen. Audit separat.
  Grok granskar en fryst revision i egen syntetisk kopia, max2samlade fixvarv.
  Inga dubbla QA-beställningar eller samtidiga skrivare.
- Privat push/Actions och samma skyddade preview efter QA enligt fortsatt
  arbetssätt, backup före migration och tydlig actual-deployverifiering.
  Ingen mainmerge/force-push, offentlig åtkomst, skarp data eller fler epics.
  Uppdatera befintlig status/handoff/ägarrapport med faktiska resultat/NOT RUN.
