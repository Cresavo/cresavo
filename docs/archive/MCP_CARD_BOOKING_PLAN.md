# Avgränsat bokningsprov från MCP-kort till admin

Godkänt av Niclas 2026-11-13 efter det lokala tidvalsprovet. Bas `fdcb41b`,
branch `feature/mcp-card-booking-proof`. Ingen ny epic eller molnändring.

## Acceptans

- PC-kortet visar tjänst, utförare, datum, Stockholmstid, längd och ordinarie
  pris före en uttrycklig bekräftelse. Testkunden är fast och syntetisk.
- Vanligt läsläge förblir standard. Skrivning kräver separat lokal opt-in,
  båda befintliga bokningsflaggorna och en separat loopback-demodatabas.
  Inga adminverktyg eller verkliga kontaktfält exponeras i kortet.
- Samma `createBooking`, klient-/e-postkvoter, idempotens, lås och exclusion
  används. Kortet är inte en privilegierad adminbokningskanal.
- Dubbeltryck ger en bokning. Sekventiell retry och 20 samtidiga anrop med
  samma nyckel ger samma id och exakt en rad. Ändrat payload nekas.
- Tappat svar kan betyda att bokningen lyckades: behåll samma nyckel/payload,
  erbjud retry och påstå inte att inget skapats. Inget nytt försök med ny nyckel
  innan utfallet klarlagts i kortet. Nytt val efter ett definitivt konfliktbesked
  kräver ny bekräftelse. Upptagen tid går att ersätta utan att börja om.
- Verklig bokning syns i ordinarie skyddad admin i samma lokala databas.
  Separera egna browser-/MCP-testvärdar, användarens PC-prov och Groks tester.
- Tydlig datumgräns; tangentbord och smala vyer. Riktade riktiga skärmbilder.

## Genomförande och gränser

Återanvänd befintligt privat plugin och lokal stdio. Gammal läsprofil/SQL-roll
bevaras; skrivprofil aktiveras först efter verifiering och fryst Grok-QA.
Inga nya beroenden, historiska migrationer, autentiseringssystem, fjärr-MCP,
utskick, betalningar, verkliga kunder, kostnader, mainmerge eller deploy.
Inga fria kunduppgifter eller registeruppslag. Bekräftelsefältet är klientens
försäkran; det är inte kryptografiskt bevis på mänskligt mandat.

Codex ensam skrivare. Grok granskar en fryst revision i separat syntetisk
kopia genom befintlig konversation, högst två samlade rättningsvarv.
Privat leveransbranch får pushas efter verifiering/QA enligt tidigare flöde;
ingen huvudbranch ändras. Mobilanslutning ligger kvar som separat olöst fråga.
Resultat/NOT RUN införs i befintliga VERIFICATION, PROJECT_STATUS och HANDOFF.
