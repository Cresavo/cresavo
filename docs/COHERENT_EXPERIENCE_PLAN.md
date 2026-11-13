# Sammanhängande salongsupplevelse

Godkänt av Niclas 2026-11-13. Bas3273934/produkt05e5eaf på separat
feature/coherent-salon-workspace. e702838 och webb95f8071 är föregångare.
Senare webbändring före detta uppdrag är den granskade replaygränsen i publik
boknings-API. Codex ensam skrivare; bevara gamla profiler, bokningar och migrationer.

## Faktisk första genomgång

CUA-klicktest av produkt/kundval på befintlig05-runtime3187. Ägarens samtliga
huvudsidor granskades i samma frysta produkt mot NY separat syntetisk
booking_coherence_review_demo på loopback3198 med befintliga demo-/kapacitetsseed.
Inga gamla bokningar ändrade. IAB390/desktop1264 och Chrome320, inte fysisk iPhone.

| Observerat | Reproduktion och konsekvens | Rättning |
| --- | --- | --- |
| Kalenderfilter tappas | Välj Sofia → bokning → Till kalendern: enbart datum kvar. | Bevara exakt ursprungsvy/filter och returposition. |
| Kundsökning tappas | Sök Mira → kundkort → Till kunder: q försvinner. | Kontextbunden retur och säker direktlänksfallback. |
| Bokning → kundkort saknar retur | Kundkortet har bara Till kunder. | Till bokningen med kalenderkontext kvar. |
| Stor mobilmeny | Sex huvudval/kontolänkar upptar cirka310px på390. | Tre primärval, Salongen som sekundär ingång. |
| Otydlig redigering | Tjänster/personal öppnar alltid första posten, saknar Avbryt. | Medvetet postval, Stäng/Avbryt/Spara. |
| Motstridig förslagsstatus | Inaktuellt underlag visas samtidigt som Behöver beslut. | Skilj behov, utkast, publicerat och inaktuellt. |
| Upprepad demo | Banner/fält/hjälprader/bokningsslut upprepar budskap. | Diskret global märkning; testdataregler består. |

Native JavaScript-lämnabekräftelse blockerade IAB-styrningen vid personaltest.
Det är en kontrollbegränsning, inte bevis på lyckad avbrytning. Fortsatt Chrome-
granskning och automatiska negativa tester särredovisas. Före-bilder sparade.

## Leverans och grindar

- Tre begripliga användarlägen med befintliga sidor och kompakt gemensam adminram.
- Kalender ↔ bokning ↔ kundkort och sökning ↔ kundkort behåller kontext även
  efter sparande. Säker reservväg vid direktlänk; ingen öppen redirect.
- Ingen automatisk lagring vid navigation. Äkta utkast skyddas; avbryt sparar
  ingenting. Tangentbord, Escape och fokus provas.
- Oförändrade kapacitetsregler, verklig kampanjomfattning och begripliga
  förslag/granskning/bekräftelse/resultat; inga nya agentlöften.
- Mobil320/390 och desktop, riktiga före/efter-bilder. Fysisk Safari särredovisas.
- Lint/tsc/unit, isolerad PG-integration, MCP-kort, webb i fyra lägen, build;
  audit separat. Inga sänkta kontroller eller nya beroenden.
- Fryst Grok-QA i egen syntetisk kopia, högst två samlade rättningsvarv.
- Privat push/exakt CI och samma skyddade preview efter verifiering; kontrollera
  faktisk revision/perimeter och förenklad demoåtkomst.

Inga nya produktmoduler, auth-/ramverksomskrivningar, datamodeller, drift,
kostnader, åtkomster, riktiga data, utskick, offentlig release eller mainmerge.
Produktägarens slutliga UX-godkännande återstår; det får inte hittas på.
