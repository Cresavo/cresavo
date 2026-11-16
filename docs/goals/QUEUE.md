# Goal-kö

**Regel för agenter:** ta det översta goalet med status `ledig`, sätt
`pågår · <agent> · <gren> · <datum>` och pusha det direkt (så att ingen annan
tar samma). Jobba tills "Klart när" är uppfyllt, sätt `klar`, skriv i
PROGRESS.md och **ta nästa ledig utan att fråga**. Är kön tom eller blockerad:
kör "Städpass" längst ner. Sluta aldrig bara för att ett goal är klart.

**Grenar:** en agent åt gången kör direkt på `concept/ai-native-demo`.
Kör två agenter samtidigt: gör `goal/<nr>-<kortnamn>` från senaste
`concept/ai-native-demo`, och slå ihop tillbaka dit när goalet är klart
(aldrig till `main`).

**Vem:** `Codex` = väl specificerat UI- och funktionsbygge och städpass.
`Opus` = arkitektur, AI-lager, flytt till riktig backend, granskning.
`Båda` = vem som helst. Läs alltid CONCEPT.md för helheten.

Gemensamt "Klart när" för alla goals: lint, tsc, test och build gröna;
skärmbilder 390 px + 1280 px av nya/ändrade vyer i `docs/concept/screens/`;
PROGRESS.md uppdaterad; sidofynd som issues med etiketten `fynd`.

| # | Goal | Vem | Status |
|---|---|---|---|
| 1 | Klickbar demo natt 1 ([fil](../concept/CODEX_GOAL_NIGHT1.md)) | Båda | pågår · Claude (steg 1–2) |
| 2 | Kundupplevelsen | Codex | ledig |
| 3 | Kunder, journal och återbesök | Codex | ledig |
| 4 | Marknadsstudion | Codex | ledig |
| 5 | Lager och inköp | Codex | ledig |
| 6 | Ekonomi och överblick | Codex | ledig |
| 7 | AI-lagret på riktigt | Opus | ledig |
| 8 | Support, logg och "Vad har hänt?" | Båda | ledig |
| 9 | Moduler och branschpaket | Båda | ledig |
| 10 | Öppna protokoll för konceptet | Opus | ledig |
| 11 | Från demo till riktig motor | Opus | ledig |

---

## 2 · Kundupplevelsen

**Mål:** en kund som aldrig bokat online ska fatta direkt och boka på under en minut.

- `/boka/salong-eko`: förfina "Vad vill du boka?" (fler formuleringar,
  felstavningar, "så snart som möjligt", "efter jobbet", "med Anna").
- Kundens egen sida via länk: kommande/tidigare bokningar, boka om med
  samma behandling, avboka med tydlig regel ("fritt fram till 24 h innan").
- Väntelista: "Meddela mig om något blir ledigt" när fullt; ägaren ser den
  i Inkorg och "Fyll luckan" använder den.
- Påminnelser och bekräftelser som förhandsvisning (SMS- och mejlutseende),
  med simulerad "skickat"-logg i Inkorg.
- Omdöme efter besöket: 1–5 stjärnor + text, visas på salongens sida efter
  ägarens godkännande.
- Bokningsknapp/widget att bädda in på egen hemsida (kopiera kod-ruta i
  Mer → Inställningar) och en ren delningslänk för Instagram-bio.

**Klart när:** en testperson kan boka, boka om, avboka, ställa sig i kö och
lämna omdöme på mobil utan instruktioner; allt syns hos ägaren.

## 3 · Kunder, journal och återbesök

**Mål:** kundkortet är det bästa stället att förstå en kund på fem sekunder.

- Kundkort: överst AI-sammanfattning ("Stamkund sedan 2024, fotvård var
  6:e vecka, känslig hud, föredrar Anna, eftermiddagar").
- Journal: röstinmatning → struktur (från goal 1), mallar per tjänst
  (fotvård, massage), bilder före/efter (demobilder), versionshistorik.
- Återbesöksmotor: intervall per tjänst, lista "sena" kunder, ett tryck
  "skicka förslag på tid" (simulerat SMS med färdig länk).
- Segment: "inte varit här på 3 mån", "stamkunder", "nya i år", "fyller år
  denna månad" – används av Marknadsstudion.
- Import av kunder från CSV (demo: exempelfil) med förhandsgranskning.

**Klart när:** öppna valfri kund → sammanfattning, historik, journal och
nästa föreslagna besök syns; röstjournal sparas och syns i historiken.

## 4 · Marknadsstudion

**Mål:** från idé till publicerad kampanj i alla kanaler på två minuter.

- Kampanjflödet från CONCEPT.md: erbjudande/högtid → text per kanal →
  affisch från mall → förhandsvisning per kanal → publicera/schemalägg.
- Affischmallar: 4–6 stilar, salongens färger/logga/foton, export som PNG
  (format: Instagram-inlägg, story, A4 för skyltfönster).
- Innehållskalender: månadsvy med planerade inlägg och högtider.
- Annonsflöde: budget, dagar, närområde, förväntad räckvidd (simulerat).
- Resultat per kampanj: räckvidd, klick, **bokningar via länken**, intäkt.
- "Idag" föreslår kampanjer automatiskt (lediga tider + högtid + segment).

**Klart när:** skapa en fars dag-kampanj från Idag-kortet → texter + affisch
→ "publicera överallt" → kampanjen visar simulerad statistik och bokningar.

## 5 · Lager och inköp

**Mål:** ägaren behöver aldrig räkna burkar.

- Produkter med saldo, minsta nivå, leverantör, inköpspris.
- Förbrukning per behandling (fotvård drar 1 portion fotkräm) som
  automatiskt minskar saldot när besök markeras klart.
- Försäljning av produkt till kund (utan kassa: markera "såld").
- Prognos: "tar slut om ca 9 dagar", inköpslista att godkänna, simulerad
  beställning till leverantör (mejlutkast).
- Inleverans: skanna/skriv in, eller fota följesedel (demo: fördefinierad).
- Proaktiva kort på Idag.

**Klart när:** klarmarkera besök → saldo minskar → varning på Idag →
godkänn inköpslista → inleverans ökar saldo.

## 6 · Ekonomi och överblick

**Mål:** "Hur går det?" besvaras på en skärm.

- Översikt: intäkt (dag/vecka/månad/år), beläggning per person, populära
  tjänster, avbokningar/uteblivna, nya vs återkommande kunder, jämfört med
  förra perioden. Enkla, snygga SVG-grafer.
- Fråga med kommandorutan: "jämför mars med förra året", "vilken tjänst
  tjänar mest per timme?" → svar med graf.
- Kostnader (hyra, produkter, avgifter) inmatade enkelt → resultat.
- "Koppla bokföring": Accounted-kort (simulerad koppling, visar vad som
  skulle synkas), export SIE/CSV.

**Klart när:** Ekonomi-vyn och tre frågor via kommandorutan ger rimliga
svar ur demodatan.

## 7 · AI-lagret på riktigt

**Mål:** alla AI-uppgifter körs genom ett lager som blir bättre när
modellerna blir bättre, och som klarar egna nycklar.

- Uppgiftsregister (från goal 1 steg 3b) med versionerade promptar,
  JSON-scheman och utvärderingsfall (exempel in → förväntad struktur ut).
- Router: nivå → leverantör/modell; OpenRouter, OpenAI, Anthropic; egen
  nyckel per verksamhet (BYOK) med krypterad lagring i demo-läge.
- Eval-skript `npm run ai:eval` som kör alla fall mot vald modell och visar
  träffsäkerhet, tid och kostnad, så modellbyten kan bedömas med siffror.
- Kostnadsloggen persisteras och visas per uppgift/månad.
- Kommandorutan använder verktyg/funktionsanrop i stället för fri text.

**Klart när:** `npm run ai:eval` går grönt med regelvarianten och med minst
en riktig nyckel; byte av modell för en uppgift görs på ett ställe.

## 8 · Support, logg och "Vad har hänt?"

**Mål:** en person kan supporta hundratals salonger. Se CONCEPT.md
"Drift, loggning och support".

- Händelselogg i store: vem (människa/AI/integration), vad, före/efter.
  Vy "Vad har hänt?" med filter och **Ångra**.
- Papperskorg för raderade bokningar/kunder (30 dagar).
- Hjälpknapp: AI-svar från en liten kunskapsbank (`docs/help/*.md`, skriv
  10–15 artiklar), "visa mig" som markerar rätt knapp, och "skapa ärende"
  som paketerar skärmbild, request-id och senaste händelser.
- Supportläge: tidsbegränsad åtkomst som ägaren ger och ser i loggen.
- Strukturerad serverloggning med request-id i `/api/concept/*`.

**Klart när:** ändra något via AI → syns i "Vad har hänt?" → ångra fungerar;
hjälpknappen besvarar 5 vanliga frågor.

## 9 · Moduler och branschpaket

**Mål:** samma kärna passar fler branscher; man betalar bara för det man slår på.

- Modulregister: varje modul (Journal, Lager, Marknad, Ekonomi, Omdömen,
  Väntelista, AI-assistent) har manifest: namn, beskrivning, menyval,
  Idag-kort, AI-uppgifter, pris (demo).
- Funktioner-sidan visar moduler som kort med på/av och pris.
- Branschpaket: Fotvård/massage, Frisör, Naglar, PT, Klinik – ord,
  standardtjänster, journalmallar och moduler. Byt paket i demo → appen
  anpassar sig (ord, menyer, demodata).
- Onboarding: "Vad har du för verksamhet?" → 3 frågor → färdigt upplägg.

**Klart när:** byt till Frisör-paketet → tjänster, ord och menyer ändras;
stäng av Lager → försvinner överallt.

## 10 · Öppna protokoll för konceptet

**Mål:** konceptets data och åtgärder nås av externa AI:er. Se CONCEPT.md
"Öppna protokoll".

- Gemensamt verktygsregister för konceptets åtgärder (samma som
  kommandorutan använder).
- MCP-server (HTTP) som exponerar läsverktyg för allt + skrivverktyg som
  skapar **förslag** som ägaren godkänner i appen.
- A2A-kort och USP-profil för kundbokning.
- "Din data & AI" visar status per protokoll + instruktioner för Claude
  Desktop/Code och ChatGPT.
- Återanvänd mönster från befintliga `src/mcp` och `/api/v1` (mandat,
  idempotens), men koppla inte ihop med Prisma ännu.

**Klart när:** Claude Code kan via MCP lista dagens bokningar och skapa ett
flyttförslag som syns i Inkorg och kan godkännas.

## 11 · Från demo till riktig motor

**Mål:** de bästa delarna av konceptet körs mot riktig databas och
befintlig bokningsmotor.

- Kartlägg: vilka konceptdelar som har motsvarighet i `src/lib/domain.ts`,
  Prisma och `/api/v1`, och vilka som saknas. Skriv plan i `docs/goals/`.
- Byt store-lagret mot ett API-lager bakom samma gränssnitt (flagga:
  demo-läge kvar). Börja med bokningar, kunder, tjänster, personal.
- Nya tabeller via additiva migrationer för journal, lager, kampanjer, logg.
- Behåll dubbelbokningsskydd, idempotens och kvoter; testa mot `_test`-DB.

**Klart när:** `/studio` i riktigt läge bokar/flyttar mot Postgres med
samma UI, och demo-läget fungerar fortfarande.

---

## Städpass (när kön är tom eller blockerad)

Ta öppna issues med etiketten `fynd` (sedan `ux`, `bug`), minsta först.
Ett issue = en commit som refererar `#nr`. Stäng issuet med en kort
kommentar om vad som gjordes. Hitta du nya saker: nytt issue, inte
scope-glidning. Passar bra för en billig/snabb modell.
