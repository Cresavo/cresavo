# Arbetsmål — färdigställ och synka Epic 02–04

Produktägaren godkände 2026-11-12 att fortsätta samma Codex/Grok-arbetssätt och pusha färdiga brancher till det befintliga privata repot. Detta ersätter tidigare pushstopp för färdiga Epics, men tillåter ingen merge till main, deploy, publik publicering eller verkliga data.

## Goal prompt för fortsatt arbete

Slutför de redan godkända Epic 02, 03 och 04 som syntetisk lokal POC. Bevara bokningsregler, origin-/sessions-/proxykontroller, kvoter, idempotens, databasens exclusion och historiska migrationer. Läs AGENTS, aktuell plan, VERIFICATION och HANDOFF. Kontrollera Git-status först; skriv inte över andra ändringar.

Arbeta med små uppgifter och lokala commits. Kör verkliga tester på egen loopbackdatabas; följ testvakten och kör en tung matris åt gången. Ingen automatisk majoruppgradering, inga odefinierade produktfunktioner. Individuell admin är Epic 04; Visa kund-e-post är fortsatt utanför scope.

Ge Grok en fryst revision med rensad källkod, inga .env, cookies eller riktiga uppgifter. Grok granskar i egen miljö. Bedöm rapporten mot acceptanskriterierna; rätta reproducerade blockerande fel i högst två begränsade varv. Stilförslag och framtida produktval dokumenteras separat. Skapa inte parallella QA-körningar.

Spela in en produktionsdemo när den synliga Epic-leveransen är färdig, inte vid varje rättning. Ange faktisk revision, resultat och vad som visuellt kontrollerats. Uppdatera PROJECT_STATUS, VERIFICATION, HANDOFF och svensk PRODUCT_OWNER_REPORT med verkliga PASS/FAIL/NOT RUN.

När en Epic är färdig och granskad: pusha dess branch till befintligt privat origin och läs GitHub Actions-resultaten för den exakta revisionen, inklusive samtliga fyra E2E-jobb och separat audit. Dölj inte känt rött audit-jobb. Ingen merge till main. Ge produktägaren branchlänk, commit, QA-rapport och tre rekommenderade nästa mål.

Om något blockeras: dokumentera reproduktion, säkerhetsbetydelse och vilken information eller vilket produktbeslut som saknas. Fortsätt med oberoende godkända uppgifter; kringgå inte skydd eller kalla en blockerad Epic färdig. Starta inga framtida Epics vars scope inte är definierat/godkänt. Pilot förblir NO-GO tills dess separata grindar är uppfyllda.

## Aktuell avgränsning

Epic 02 och 03 är redan godkända av oberoende QA och pushade. Epic 04 har lokal slutmatris och demo PASS, full-QA på3419973 och riktad slut-QA på471f91f godkända. Alla tre brancher är pushade;4 E2E-jobb gröna vardera, känt audit-undantag dokumenterat i CI_DELIVERY_2026_11_12.md. Slutlig dokumentpush kontrolleras vid överlämningen. Aktuella detaljresultat finns i VERIFICATION, inte i denna arbetsinstruktion. Kommande GDPR/MFA/driftarbete är rekommendationer, inte automatiskt godkända nya Epics.
