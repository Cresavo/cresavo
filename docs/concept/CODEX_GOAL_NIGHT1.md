# Codex goal-prompt · natt 1 · klickbar AI-native demo

Kopiera allt under linjen till Codex. Starta i repot booking-lab-se på gren
`concept/ai-native-demo` (hämta den först: `git fetch && git checkout concept/ai-native-demo`).

---

Du bygger en klickbar, levande demo av ett AI-native salongssystem. Läs
`AGENTS.md` och `docs/concept/CONCEPT.md` först – de är hela underlaget.
Läs inga andra docs om du inte behöver dem för något konkret.

## Mål för natten

Niclas ska i morgon kunna öppna `/studio` och `/boka/salong-eko` på mobil och
dator, klicka runt överallt, se realistisk data och prova kommandorutan –
och få en tydlig känsla för hela systemet. Allt behöver inte vara på riktigt,
men allt synligt ska reagera (knappar gör något, förslag kan godkännas och
syns sedan i kalendern/listan).

## Arbeta i den här ordningen. Commita och pusha efter varje steg.

Läs först `docs/concept/PROGRESS.md`. Om Claude eller någon annan redan har
gjort ett steg: fortsätt därifrån, bygg om inte det som finns.

1. **Grund**
   - `src/concept/data/` – fixture-data enligt CONCEPT.md "Demodata"
     (salong, personal, ~40 kunder, tjänster, bokningar relativt dagens datum,
     6 månaders historik, lager, omdömen, inkorg, högtidskalender).
     Generera deterministiskt (seedad slump) så det ser likadant ut varje gång.
   - `src/concept/store.ts` – klientstate (React context + `localStorage`,
     try/catch) med åtgärder: flytta/avboka/skapa bokning, ändra pris,
     skapa kampanj, lägga journal, justera lager, markera inkorg läst.
     Knapp "Återställ demo" i Mer → Inställningar.
   - Designsystem i `src/concept/ui/`: lugn, varm, modern salongskänsla.
     Stora tryckytor (min 44 px), tydlig typografi, mjuka kort, en accentfärg,
     ljust och mörkt läge. Mobil först. Ikoner från befintliga lucide-react.
   - Kundavatarer som genererade SVG (initialer, pastell). Återanvänd bilder
     i `public/demo/` för salong/tjänster.

2. **Ägarens app `/studio`** med layout: bottenflikar på mobil
   (Idag · Kalender · Kunder · Inkorg · Mer), sidomeny på dator.
   - **Idag**: tidslinje, nästa kund, proaktiva kort (luckor, lager, högtid,
     sena återbesök), dagens intäkt, knapp "Någon ringer" (telefonläge).
   - **Kalender**: dag- och veckovy, personalfilter, tryck för detaljer,
     flytta via dialog (dra-och-släpp på dator om tiden räcker).
   - **Kunder**: sök, kundkort (bild, kontakt, historik, anteckningar,
     journalflik, "boka igen"), markering för sena återbesök.
   - **Inkorg**: förfrågningar/ombokningar/omdömen, svara med ett tryck.
   - **Mer**: Tjänster & priser, Personal, Lager, Kampanjer (med
     högtidskalender + affischförslag som genererad HTML/SVG-affisch),
     Ekonomi (intäkt per månad/tjänst/person som enkla grafer – SVG, inget
     nytt beroende), Omdömen, Funktioner (moduler på/av som döljer menyval),
     Din data & AI (visar MCP-anslutning med kopiera-knapp + exportknapp
     som laddar ner JSON/CSV av demodata), Inställningar.

3. **Kommandorutan** – komponent som finns överst på alla `/studio`-sidor
   plus flytande mikrofonknapp på mobil.
   - `src/concept/intent/` – regelbaserad svensk tolk (veckodagar, "idag",
     "i morgon", "nästa tisdag", klockslag, kundnamn med fuzzy match,
     tjänstenamn, procent/pris). Returnerar `{action, params, summary}`.
     Täck alla exempel i CONCEPT.md + varianter. Skriv vitest-tester för tolken.
   - Resultat visas som **förslagskort**: vad som ändras före/efter,
     knappar Godkänn / Ändra / Avbryt. Godkänn kör store-åtgärden och visar
     en kort bekräftelse med "Ångra".
   - Frågor ("vad har jag tjänat…", "vilka kunder…") svarar med siffra,
     lista eller liten graf i kortet.
   - Tal: webbläsarens `SpeechRecognition` med `lang = "sv-SE"`; dölj
     mikrofonen snyggt om det saknas.
   - Valfritt AI-läge: `src/app/api/concept/intent/route.ts` använder
     `OPENAI_API_KEY` om den finns (fetch mot OpenAI, ingen ny SDK krävs),
     ber om samma JSON-struktur och faller tillbaka på regeltolken.
     Visa liten etikett "AI" eller "Snabbtolk" på kortet.

3b. **AI-lagret** (se CONCEPT.md "AI-arkitektur") i `src/concept/ai/`:
   - `tasks/` – en fil per uppgift (`interpret-command`, `structure-journal`,
     `write-post`, `suggest-campaign`, `stock-forecast`, `reply-customer`,
     `daily-summary`) med prompt, JSON-schema för svar, modellnivå
     (`fast`/`smart`/`image`/`speech`) och en regelbaserad fallback.
   - `router.ts` – nivå → leverantör + modell. Läser `OPENROUTER_API_KEY`,
     `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` på servern. OpenAI-kompatibel
     fetch-klient (fungerar mot OpenRouter och OpenAI); Anthropic via egen
     liten adapter. Inga nya beroenden.
   - `api/concept/ai/[task]/route.ts` – kör uppgiften, validerar svaret mot
     schemat, faller tillbaka på regelvarianten, loggar uppgift/modell/
     uppskattad kostnad (i minnet, visas i Mer → Din data & AI).
   - Mer → Din data & AI: visa vilka uppgifter som finns, vilken nivå/modell
     de kör, "Lägg till egen nyckel (OpenRouter/OpenAI/Anthropic)" som
     demo-formulär (sparas inte på riktigt), och kostnadslogg.

4. **Röstjournal** på ett besök/kundkort: "Prata in journal" →
   transkribering (SpeechRecognition, eller `api/concept/transcribe` med
   OpenAI om nyckel finns) → strukturerad anteckning (behandling,
   observationer, råd, föreslaget nästa besök) → redigera → spara.
   Utan nyckel: enkel regelbaserad strukturering av texten.

5. **Kundens sida `/boka/salong-eko`**: salongsbild, info, omdömen,
   tjänster. Överst rutan "Vad vill du boka?" → tre tidsförslag som kort →
   namn + telefon → bekräftelse (lägg i kalender, boka om, avboka).
   Klassiskt 3-stegsflöde som alternativ. Bokningen syns sedan i `/studio`
   (samma `localStorage`-store) och som ny post i Inkorg.

5b. **Kampanjstudio** (Mer → Kampanjer): välj erbjudande eller
   högtidsförslag → text per kanal (Instagram, Facebook, TikTok, nyhetsbrev,
   SMS) från `write-post` → affisch från mall (salongsfoto + text + pris,
   2–3 stilar) → förhandsvisning som det ser ut i varje kanal → "Publicera
   överallt"/"Schemalägg" (simulerat) → kampanjen får spårbar länk och
   simulerad statistik (räckvidd, klick, bokningar via länken).
   Knapp "Kör som annons" med budget/dagar/närområde (simulerat).

6. **Startsida**: lägg till tydliga länkar till `/studio` och
   `/boka/salong-eko` från `/` (liten ändring, rör inget annat där).

## Kvalitet

- `npm run lint`, `npx tsc --noEmit`, `npm test` och `npm run build` ska
  vara gröna innan du slutar. Lägg tester för tolken och store-åtgärderna.
- Kör appen och ta skärmbilder (Playwright finns) av varje ny sida, 390 px
  och 1280 px, till `docs/concept/screens/`.
- Inga konsolfel. Inga horisontella scrollbars på mobil.
- Svenska i allt UI. Alla AI-förslag märks som förslag.

## När du är klar (eller tiden tar slut)

Uppdatera `docs/concept/PROGRESS.md`: vad som är klart, hur man provar,
skärmbilder, vad som återstår, och dina egna förslag på förbättringar.
Commita och pusha. Ingen deploy, ingen merge till main.
