# Produktägarrapport — kunddata och direkt ägaragentprov, 2026-11-13

[Öppna uppdaterade skyddade Booking Lab](https://booking-lab-se-preview.vercel.app/admin/customers).
Vercel vid behov, sedan demoknapp. Bara påhittade uppgifter, ingen kundpilot.

**Byggt:** kundkort kan exporteras i begränsade JSONdelar och kontaktuppgifter
tas bort efter förhandsgranskning/kryss. Kopplade kontaktkopior minimeras,
teknisk bokningshistorik består. Automatisk gallring är avstängd enligt ditt
beslut. Grok hittade en rå e-postkvotkopia; den är rättad med HMAC utan att
återbetala bokningstaket. Inga nya projektberoenden eller större UIändringar.

**Prova nu:** skapa eget nytt example.test-kort, förbered/hämta export, läs
omfattningen och bekräfta kontaktborttagning. För historik: boka via kortet,
avboka besöket först, och kontrollera sedan bevarad tid/pris under Tidigare.
[Fem provsteg och riktiga före-/efterbilder](DEMO.md).

**Agentdelen fungerar också:** denna Codex-konversation anropade faktiskt
lokal MCP, sparade ett20%-utkast16november och fick samma id påretry.
Ändradretry/confirmedfalse/stale nekades. Egen webbåterbokning gjorde förslaget
inaktuellt; utkastet bestod opublicerat.1beslut/1ledger,0överlapp.
Detta finns i lokal isolerad demodatabas, inte i previewns kampanjlista.
[Transkript/källa/bilder](agent-proof/OWNER_AGENT_2026-11-13.md).

Branch **feature/customer-lifecycle-agent-proof**, produkt **95f807196f9b15e0bae2afdcd89604837cf747dd**.
Privat push klar, ingen mainmerge. Grok stängdeLC-QA-1 på samma kod efter1fixvarv
och gav syntetiskt GO; inga nya Medium+. [Original](qa/QA-REPORT-lifecycle-fix1-95f8071.md).
Lokalt79unit/99integration/46E2E×4, lint/tsc/build PASS. [Actions43393207291](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43393207291)
har4gröna46/46. Audit separat7moderate dev/0prod. [Kommandon och utdata](VERIFICATION.md).
Grok körde egna79/99/46prod och granskade vårt agentunderlag, inget eget PC-/molnprov.

**Verklig preview:**95f8071, dpl_<redacted>, samma stabila skyddade länk,
SSOall kvar. Auth/origin/export/nedladdning/20retries/logout,320/390/1440 och
återläsning12/13tabeller PASS. Befintliga92bokningar/33kort oförändrade.
Operatörsproberna hade två antagandefel som rättades utan produktkodändring;
misslyckade försök är redovisade. Ett för tidigt bygge avbröts utan aliasbyte.

**Återstår:** fysisk iPhone/Safari och ditt UX-godkännande; fullständiga
kundrättigheter/lagringstid/oanknutna bokningar/backups, MFA/recovery och
drift-/leverantörsgrindar. Hashar/ID är fortfarande personrelaterbara; separat
kvotnyckel/rotationsrutin behövs före pilot. Ny extern MCP/AIleverantör/OAuth
är inte byggd. Ingen automatisk extern backup eller nya abonnemang/tillägg;
faktisk faktura ej verifierad. Pilot fortfarande NO-GO.

**Tre nästa avgränsade leveranser:**

1. Din fysiska iPhone/Safari-provning av femstegsflödet; samla konkreta UXfel.
2. En pilotchecklista för vald salongstyp: retention/rättighetsärenden,
   oanknutna bokningar, hash-/nyckelrotation och återläsning utan återinförda kontakter.
3. Individuell MFA/recovery och driftgrind med återläsnings-/felövning innan
   riktig kundpilot. Externa assistenter får en separat avgränsad anslutningsplan.

Uppdrag2–3 är slutfört som syntetisk POC. Inga nya epics startas automatiskt.
