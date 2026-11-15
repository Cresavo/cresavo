# Direkt agentprov 2026-11-13 — delresultat

**Historiskt delresultat, ersatt av [slutprovet](COMPLETION_2026-11-13.md).**
Datorstyrning och webbstart återställdes senare; nedan bevaras vad som faktiskt
var möjligt vid det första försöket, inte aktuella blockerare.

Branch `experiment/calendar-agent-proof`, HEAD `b8de7489cfdbe87de2dea33305ffcbc8c900fc5d`, produktbas `7c1407d`. Befintliga ocommittade ändringar bevarades. Detta är inte en fullständig slutgranskning.

Direkta MCP-verktyg i denna session: endast `list_services` och `get_availability`. `list_services` gav Massage, 30 minuter, 450 kr. `get_availability` anropades för `massage`, `staff-demo` och var och en av 16–20 november 2026. Varje dag fanns starter 16:00 och 16:30 i Europe/Stockholm. Seed identifierar `staff-demo` som Anna. Inga kalenderfält skickades i MCP-argumenten.

Manuell jämförelse av svaren med `work.json` och `private.json`, halvöppna intervall och respektive coverage:

- Ursprungliga underlag: en match, tisdag 17 november 16:30–17:00.
- Separat tänkt variant där endast privatintervallet onsdag 18 november 16:00–16:30 tas bort: två matchningar, tisdag 16:30 och onsdag 16:00, båda 30 minuter.
- Separat tänkt variant där privatkalendern är upptagen hela coverage: noll matchningar. Detta visar ingen kalenderkompatibel tid, inte en fullbokad salong. Ett vidare sökfönster kräver kalenderunderlag som täcker det.

Loopbackdatabasen verifierades som `booking_calendar_agent_demo` på port 55451: noll bokningar och noll admin före försöket. Ett syntetiskt adminkonto skapades för planerad adminverifiering; det inaktiverades åter när användargränssnittet inte gick att nå. Ingen bokning skapades. Ett försök att starta lokal webb avbröts utan observerad lyssnande port eller READY-signal. Ingen tunnel eller fjärrdrift skapades.

Computer Use: inventering av appar/fönster gav timeout även efter omstart av verktygssessionen; webbläsarstyrning rapporterades avstängd i Work-inställningar. Kundvy, adminvy, konfliktfall och befintlig Grok-konversation kunde därför inte kontrolleras. Ingen ny Grok-beställning skickades; `QA_TEXT_REVIEW.md` avser endast tidigare textberäkning. Ingen GO för fullständigt agentprov. Nästa steg är att återställa tillgänglig dator-/webbläsarstyrning, kontrollera den lokala webbens start och därefter köra bokning, admin och konflikt på samma databas innan ett fryst faktiskt slutunderlag skickas till befintlig Grok-konversation.
