# UI-polering — befintlig salongsupplevelse

Godkänt av Niclas 2026-11-13 efter egna bilder av kalender och översikt.
Bas 2c74a4b (produkt 51d54d4), branch ui/salon-polish. Ensam skrivare.

Mål: professionell typografi, utnyttjad desktopbredd, samlad kalenderkontroll,
läsbara bokningskort och tydliga verkliga förslag/status. Befintliga funktioner,
returkontext och kundflöden bevaras. Sidomeny på bred skärm; kompakt mobilnav.

Ingen ny produktmodul, datamodell, API/MCP-behörighet, dependency eller kostnad.
Samma skyddade preview efter tester, fryst separat Grok-QA och högst två
samlade rättningsvarv. Inga nya agentlöften eller konstgjord statistik.

Acceptans: 320/390/1440 px utan sidoscroll i centrala handlingar; korta bokningar
har begripliga etiketter och detaljväg; fokus/tangentbord/retur fungerar; verkligt
förslag → granskning → utkast/resultat oförändrat; befintlig testmatris grön.
Faktisk iPhone/Safari och ägarens visuella godkännande särredovisas.

Före-bilder i <local-state>/codex/booking-lab-polish-evidence/before, fångade
från verklig skyddad preview före ändringen, plus Niclas två bifogade bilder.

## Samlat rättningsvarv 1 efter Grok på 268ebdf

UP-QA-1/2: layoutCalendarCards är en liten ren presentationsfunktion per
personal/dag. Den behåller faktisk tidsposition, ger minst 24px tryckhöjd och
delar visuellt kolliderande ytor i sidled. Hover/fokus ändrar aldrig geometri.
Kompakta kort visar tid; full behandling/kund/personal finns i aria-label/title
och i vanlig bokningsdetalj. Ingen ny affärsregel eller agentbehörighet.

Fyra unitfall verifierar vanlig kalender, 20 täta kort, kort→långt och osorterat
underlag. E2E mäter verkliga 2D-rektanglar, mål24px, hover/fokus-stabilitet och
klick på nästa ursprungliga mittpunkt vid 1180/1440. Detta ersätter det tidigare
kravet på överlappande expansion82px med ett strikt krav på stabil geometri.

Samma varv återställer hjälp44px/kryssruta24px, ger kundarkivet etikett44px,
mobilfält16px samt Dag/Vecka44px. Fysisk Safari-fokuszoom är fortfarande ej provad.
UP-QA-5 förbättras med personal i tillgängligt namn; färger får upprepas och
är aldrig ensam identifiering. Mindre idéer stannar i backloggen.

## Sista samlade rättningsvarv 2

UP-F1-QA-1: borttagen transparens på kalenderns synliga kundrad. Brun palett
gav 4,27:1 efter alpha-komposition, nu 5,48:1 utan alpha. Ett riktat E2E mäter
verklig renderad text och opacitet på just denna rad. Provet verifierades rött
(4,26679) före CSS-rättningen. Inga ändringar av bokning, auth eller data.
Tidigt fixturförsök valde fel palettindex eftersom grundseed har både Anna och
Erik; fixturen rättades utan att sänka kontrastgränsen 4,5.
