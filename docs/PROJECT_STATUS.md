# Projektstatus — förbättrad skyddad demo

## Avgränsad auditomgång 2026-11-12

Full audit fortsatt **FAIL7moderate**, omit-dev **PASS0**. Ingen säker publicerad stabil rättningskedja verifierad; inga paket, produktfunktioner eller UI ändrade. Rättning är upstream-blockerad, inte klar. Nya lint/tsc/build,75unit och75integration på ny lokal syntetisk DB PASS. Inga nya E2E/CI/deploy i denna dokumentationsbatch. [Beroendebeslut och faktiska data](DEPENDENCY_REVIEW.md#audit-återkontroll-2026-11-12--rättning-blockerad-av-stabil-upstream). Driftsatt kod och senaste fungerande preview är fortsatt d7bc47f. Grok bekräftar slutsatsen i [originalrapporten](qa/AUDIT-REPORT-6acd2ef-minimatch.md); ingen stabil säker rättning finns ännu.


**Aktuell UI-leverans 2026-11-12:** [Öppna skyddad demo](https://booking-lab-se-preview.vercel.app). Logga vid behov in i Vercel och tryck **Öppna demoadmin**; inget ytterligare lösenord behövs. Endast syntetiska uppgifter, endast Niclas. Branch `ui/epic05-booking-usability`, granskad och driftsatt produktkod **d7bc47f5596cc8be06e58603fe2f32457c6b0fa0**. Senare dokumentationscommit ändrar inte previewkoden.

Tappbar svensk kalender och lediga tider, nästa lediga dag, tydlig sammanfattning/bekräftelse, bibehållna kundutkast och mobil arbetsdag med skapa/flytta/avboka. Tjänster, scheman, pauser, ledighet och kampanjer använder befintliga funktioner. Separat demo-DB med 3 aktiva behandlingar, 2 medarbetare och 33 seedbokningar; efter faktisk molnprovning 35 bokningar inklusive en avbokad. Inga utskick eller verkliga kunduppgifter.

Verifierat:75/75 unit,75/75 integration,34/34 E2E i vart och ett av dev/prod × proxy av/på; lint/tsc/build PASS. [Actions43275980287](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43275980287) kör exakt d7bc47f och alla fyra jobb är gröna. Grok har gett [GO för skyddad syntetisk preview](qa/QA-REPORT-ui-fix2-d7bc47f.md) efter två samlade rättningsvarv, inte för pilot. Faktiskt molnprov är separat från Groks isolerade granskning.

Kvar: fysisk iPhone/Safari och Niclas UX-godkännande; full audit FAIL7moderate, runtime audit PASS0. Ingen ny betald tjänst/prisplan, inget mainmerge eller publik MCP. Exakt fakturerad förbrukning och automatisk extern backup ej verifierade. [Resultat och begränsningar](VERIFICATION.md), [prova/stopp](DEMO.md), [före/efter](UI_USABILITY_REVIEW.md).

## Historik — tidigare leverans

# Projektstatus — Epic05 QA-godkänd lokal produktalpha

**Skyddad mobilpreview levererad 2026-11-12:** [Öppna preview](https://booking-lab-se-preview-i9pv3ji3h-<redacted-vercel-team>.vercel.app). Branch preview/epic05-vercel-review, faktiskt driftsatt kod f2fdac700125df2d212e824555758b8ed6d6a7a7, deployment dpl_<redacted> (Preview/fra1). Senare dokumentationscommits ändrar inte driftsatt kod. Endast Niclas via Vercel Authentication på alla deployments, dessutom individuell appadmin. Inga nya betalda abonnemang/tillägg; befintlig Pro-förbrukning kan kosta några få dollar, Neon Free. [Drift och lokal hantering av adminuppgifter](DEMO.md).

Codex:72unit/72integration/24E2E×4, lint/tsc/build PASS. Grok GO för kod/paketering efter1samlat fixvarv, [originalrapport](qa/QA-REPORT-preview-vercel-f2fdac7.md). [Actions43243542749](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43243542749): alla4jobb gröna på exakt f2fdac7. Faktisk drift: perimeter HTML/API/resurs, TLS1.3, headers, stängd appport, login/logout/copierad-cookie-replay, kundbokning, mobilkalender, tjänster/personal, flytt/avbokning och spoofing-spärr PASS. Kallstart bekräftad i Vercellogg, samma session och bokning bevarade. Ny krypterad backup återläst lokalt,10tabellers innehåll identiskt.

Kvar: fysisk iPhone/Safari NOT RUN; krypterad backup finns på PC, inte automatisk extern backup. Audit full FAIL7moderate/0high/critical, production PASS0. PV-QA-4 (eviktion vid mättat lager), PV-QA-7 (minnesspecifika unit-tester med global postgres-env) ligger i backlogg. Bara Niclas får åtkomst; AGPL-källkodserbjudande måste lösas innan andra släpps in. Ingen kundpilot, mainmerge, ny Epic eller publik MCP. [Full faktisk verifiering/NOT RUN](VERIFICATION.md).
