# Produktägarrapport – visuell leverans efter Epic 01

2026-11-11 · produktrevision `6535b59` plus denna arbetsomgångs demo-/dokumentationsändringar. **Testad lokal POC, inte redo för riktiga kunder.**

## Vad har vi byggt?

Vi har gjort den befintliga bokningen, administrationen och kampanjkedjan synliga och lätta att kontrollera. [Projektstatus](PROJECT_STATUS.md) visar acceptanskriterier, vad som fungerar, vad som är delvis klart och vad som blockerar en riktig pilot. Ett nytt kommando spelar in samma arbetsflöde som våra tester; inga nya produktfunktioner eller beroenden tillkom.

## Vad kan jag testa nu?

Öppna [lokala demogalleriet](../demo-artifacts/2026-11-11T17-17-11-326Z/index.html): tolv bilder och två korta filmer visar kundbokning, bekräftelse, adminagenda, kampanjutkast och publicering. [Manifestet](../demo-artifacts/2026-11-11T17-17-11-326Z/manifest.json) anger tid, revision och PASS. Arbetskopian var ändrad under inspelningen, vilket redovisas där.

- [Desktopfilm, cirka 10 sekunder](../demo-artifacts/2026-11-11T17-17-11-326Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-desktop/video.webm)
- [Mobilfilm, cirka 10 sekunder](../demo-artifacts/2026-11-11T17-17-11-326Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-mobile/video.webm)
- [Admin med bokning och utkast](../demo-artifacts/2026-11-11T17-17-11-326Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-desktop/04-admin-och-utkast.png)
- [Publikt erbjudande på mobil](../demo-artifacts/2026-11-11T17-17-11-326Z/flow-bokning-skyddad-admin-d3ab4-h-MCP-utkast-som-publiceras-mobile/06-publikt-erbjudande.png)

Följ [DEMO.md](DEMO.md) för egen lokal provkörning eller `npm run demo:record`. Servern startas bara under inspelningen och stängs sedan. Filmer/bilder går att öppna utan server. De finns bara lokalt och följer inte med en Git-klon. MCP-utkast skapas av en lokal protokollklient, inte en inspelad ChatGPT-/Claude-session.

## Vad blev bättre?

Du kan bedöma verkliga flöden utan att läsa kod. Varje status har kriterier och testbevis, inte uppskattade procenttal. Demon vägrar använda fjärrdatabas, fel databasnamn eller en databas med befintliga bokningar/kampanjer. Bilder, filmer och resultat får tid/revision och ligger utanför Git. Framtida Epics ska lämna samma korta rapport.

## Vad fungerar fortfarande inte eller är inte färdigt?

Ingen riktig kunddrift, individuell administratörsinloggning, avbokning/ombokning, full kalender, betalning eller fjärr-MCP. Adminvyn är en agenda. Datumfältets platsmarkör visas fortfarande som mm/dd/yyyy i den testade svenska Chromium-miljön. Mobilen kräver scroll till bokningsformuläret. Kampanjen är ett informationskort, inte automatisk rabattdebitering.

Tidigare audit-risker, drift-/GDPR-krav och verksamhetsisolering kvarstår. Docker/Compose och GitHub-CI är fortfarande ej körda på denna dator. Alla demo- och kunduppgifter är syntetiska. Första två inspelningsförsöken misslyckades på testfilter respektive screenshot/hydration; dessa är korrigerade och beskrivna i [verifieringen](VERIFICATION.md).

## Testresultat

Slutlig demo: **PASS 2/2**, desktop/mobil. Ordinarie E2E: **PASS 4/4**. Unit: **PASS 8/8**. Integration: **PASS 8/8**. Videorna kan avkodas i Chromium; två representativa bilder har granskats visuellt. Slutliga lint/build/TypeScript-resultat finns i [VERIFICATION.md](VERIFICATION.md). Testerna bevisar POC-flödena, inte produktionsberedskap.

## Tre nästa utvecklingsmål

1. **Säkra grunden för pilot:** få bort eller slutför bedömningen av beroenderiskerna och verifiera Compose/CI i en isolerad syntetisk miljö.
2. **Gör administrationen personlig och återkallbar:** individuella konton/sessioner samt skydd mot obehöriga och överdrivna anrop.
3. **Förbättra det provade användarflödet:** svensk datumupplevelse, begriplig återkoppling vid nätverksfel och avgränsad agenda. Verifiera med produktägarens praktiska provning innan funktionerna byggs ut.
