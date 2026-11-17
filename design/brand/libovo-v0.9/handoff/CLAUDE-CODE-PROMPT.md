# Uppdrag för Claude Code – Libovo Brand v0.9 / implementation

Du arbetar i befintliga Booking Lab-repot. Läs bifogat `libovo_brand_v09/` INNAN du gör ändringar.

**Viktigt:** Libovo är en preliminär varumärkesriktning, inte ett juridiskt slutgodkänt namn. Gör därför arbetet på separat branch eller bakom en feature flag, t.ex. `libovo-brand-v09`. Ändra **inte** domän, produktionsnamn eller externa integrationer; skapa inget nytt projekt om det finns ett fungerande repo.

## Mål

Implementera en sammanhållen visuell grund med light/dark, mobil först och lättanvända bokningsflöden, utan att skriva om backend eller förstöra befintliga funktioner. Färger och logovarianter finns i `tokens/`, `logo/`, `icons/`. Se `README.md`, `guidelines/` och `assets.json`.

## Fas 0: Inventera

1. Identifiera frontendstack, komponentbibliotek, routing, nuvarande tokens, fonts, temastöd, kund-/tenantteman och testverktyg.
2. Ta skärmbilder av nuvarande flöden (mobile/desktop, light/dark) så att förändring kan jämföras.
3. Kartlägg UI-komponenter: layout/nav, knappar, inputs, kalender, kundlista, ekonomi, bokningssteg, AI-assistent, marknadsföring.
4. Rapportera plan och risker kort. Fråga endast vid blockerande beslut.

## Fas 1: Inför semantiska tokens

- Mappa `tokens/libovo.tokens.css` till befintligt temalager utan att dubblera design system.
- Bygg temaväxling light/dark/system, med sparad användarpreferens och korrekt färgschema.
- En enda primary action på skärmen, konsistenta focus/hover/pressed/disabled states.
- Kontrasttesta faktiska komponenter, inte bara tokenparen. Minst WCAG AA för normalt text; även non-text contrast.

## Fas 2: Brand assets & hierarchy

- Använd `logo/libovo-wordmark-light.svg` och dark-variant på lämpliga bakgrunder. Bevara original-SVG-paths.
- Använd icons/favicons som TEMPORÄRA. Appikon har inte godkänts som unik symbol. Dokumentera att den ska ersättas före extern lansering.
- Tillämpa `Inter` för produkt-UI via projektets eget typsnittssystem; inga fontfiler ingår.
- Respektera white-label-gränsen: Salong Eko/demosalongens publika bokning ska bära kundens varumärke, INTE byta till Libovo-färger automatiskt.

## Fas 3: Mobile-first precision

- Designa och testa 320/360/390/430 först, sedan 768/1024/1440.
- Gör huvuduppgifter enkla och synliga: Idag, Kalender, Kunder, Inkorg, plus Mer, med 44×44 touchmål.
- Bokningsflöde med tydliga pris/duration/personal/tid och bekräftelse. Inga hover-beroenden.
- Kalender på mobil: dagvyn först, filtrera personal. Desktop kan använda fler kolumner.
- Ta bort stora AI-boxar på varje sida; använd kontextuella förslag, förklara vad som ska ske och begär godkännande när åtgärden påverkar kund eller ekonomi.
- Undvik horisontell overflow. Hantera empty/loading/error states, skärmläsare, långa namn, locale `sv-SE`, tangentbord och 200 % zoom.

## Fas 4: Test, leverans, godkännande

1. Uppdatera snapshots/visuella regressioner för mobil + desktop i båda teman.
2. Kör befintliga tester, lint/typecheck, a11y QA.
3. Återrapportera ändrade filer, före/efter-bilder, kända brister och vad som återstår.
4. Öppna PR eller lämna grenen för granskning. **Merga/deploya inte utan mitt godkännande.**

### Acceptanskriterier

- Komponenter använder semantiska tokens; inga nya utspridda hex-koder.
- 390px smartphone + 1440px desktop fungerar i båda teman utan sidscroll eller gömda huvudfunktioner.
- Navigation och primära actions är tydliga med tummen.
- Separata tenant/public booking-teman fortfarande korrekta.
- Inga funktionella regressioner på bokning, kunddata, priser, betalning, kalender eller AI-flöden.
- Symbolen är provisorisk och namnet ej juridiskt låst.

Börja med en kort audit och en filbaserad plan, implementera därefter fasvis. Ändra inte alla skärmar på en gång om risken för regressioner är stor.
