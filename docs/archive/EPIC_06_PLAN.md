# Epic 06 — kunder, levande demo och produktsida

Godkänt av Niclas 2026-11-12. Kumulativ bas 6acd2ef, med efterföljande
auditdokumentation 16dae9a; produktbas d7bc47f. Branch
feature/epic06-customers-demo-product. Ingen mainmerge eller offentlig release.

## A. Kundregister

- Sökbar, paginerad adminlista; skapa/redigera/arkivera kundkort med version
  och idempotens. Separat aktuell kontakt och historiska bokningssnapshots.
- Uttrycklig adminvald koppling till bokning. Ingen automatisk sammanslagning
  på namn/e-post, ingen publik kunduppslagning eller överskrivning.
- Kundkort visar paginerade kommande/tidigare/avbokade besök; ny bokning och
  återbesök förväljer kund. Bokningsdetalj länkar tillbaka till kundkort.
- Serverbehörighet och verksamhet kontrolleras före läsning/replay/skrivning.
  Rå kontakt visas endast i uttryckligen aktiverad isolerad demo; maskering i
  listor och MCP består. Arkivering är inte GDPR-radering.

## B. Demo och assets

- Additiv återkörbar seed med ungefär 25–40 kunder och 60–100 bokningar,
  relativa datum, återbesök, avbokningar/flytt och schemakonsekvens.
- Inga manuella bokningar raderas eller skrivs över; endast example.test,
  telefon utelämnas hellre än slumpas. Inga externa utskick.
- Två fiktiva vuxenporträtt, salong och några behandlingsbilder med samma
  uttryck, optimerade filer/alttexter och enkelt ursprungsmanifest. Saknade
  verktyg/budget redovisas utan att blockera kundflöden.

## C. Produktingång och leverans

- Separat produktsida med faktisk nytta, riktiga produktskärmbilder och två
  tydliga vägar: arbetsyta respektive kundbokning. Befintlig kundroute består.
- Stabil skyddad preview har begriplig ingång och behåller enkel demoadmin.
- Mobil/desktop-klickprov, snapshots/behörighet/retry/konflikt/MCP-regressioner,
  migrerad uppgraderingskopia samt två identiska seedkörningar verifieras.
- Samlad fryst Grok-granskning i separat syntetisk kopia, högst två samlade
  rättningsvarv. Egna tester, Groks prover och molnkontroller skiljs åt.
- Privat push och exakt Actions-SHA; backup före additiv molnmigration och
  verifierad revision/perimeter efter deploy. Fysisk iPhone och Niclas slutliga
  UX-godkännande återstår. Audit redovisas separat, ingen pilot.

Stoppgränser: ingen ny betaltjänst, providerbyte, offentlig MCP, journal,
massutskick, betalning, flerföretagsdrift eller omskrivning av gamla migrationer.

## Godkänt tillägg under genomförandet

Återanvänd standarddelar där de minskar arbetet. Ett litet faktiskt använt
Lucide-urval för navigation, kundsökning och bokningshandlingar ingår i samma
leverans. Inga nya stora UI-/Tailwind-ramverk. Nya komplexa interaktioner ska
föredra ett granskat sammanhängande Base UI/shadcn-urval. Befintligt kundval är
en vanlig sökform med inbyggda knappar, ingen egen combobox/listbox/dialog;
det skrivs inte om enbart för att införa ett bibliotek. TanStack Table och
React Hook Form tillför inte konkret nytta för denna paginerade kortlista
och korta formulär och installeras därför inte. Befintlig Zod består.

Referenser studerade 2026-11-12: [Twentys layoutguide](https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/getting-started/core-concepts/layout.mdx),
[Twentys aktivitetsguide](https://twentyhq-twenty.mintlify.app/user-guide/activities)
och [Cal.coms bokningsbeskrivning](https://cal.com/faq). Användbara principer:
sökbar lista → fokuserat kundkort → besök och nästa handling, samt tydligt
dag-/tidsval och bokningsdetalj med flytt/avbokning. Ingen kod, CRM-panel,
koppling till externa kalendrar eller skyddade assets kopieras. Det är
referensläsning, inte ett påstående om utförd klicktest av deras produkter.

Grok bedömer slutlig mobilfunktion, inte bibliotekets popularitet. Samma
begränsade QA-flöde och högst två samlade rättningsvarv består.
