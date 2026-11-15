# Revision av landningen — 2026-11-15

Aktuellt uppdrag: befintlig worktree `/workspace/booking-lab/landing-wt`,
`codex/landing`, bas `0fefab8`. Tidigare rapport nedan är historisk.

- Gemensam `src/components/landing/Landing.tsx` för statiska Pages Router-routes
  `/landing` och `/en/landing`; SV/EN med markerat aktuellt språk.
- Varm benvit/bläcksvart palett, små terrakottadetaljer. Ingen grön färgroll.
  Mörkt hero, större typografi/logobrickor och skiktade kort.
- Kodbyggd telefon → bro/illustrerad mandatgrind → salongskalender. CSS-loop
  på 10 sekunder, synlig tangentbordsåtkomlig paus, statiskt färdigt demokvitto
  vid minskad rörelse. Ursprunglig huvudrubrik är visuellt dold.
- Mandatgrinden är uttryckligen märkt Senare/Later. Illustrationsnotisen finns
  kvar under scenen på båda språken. Valei/Bokadirekt förekommer enbart som
  möjliga senare exempel efter avtal. Bokningsstatus/kvitto säger bokad i demo.
- Tillhandahållen `openai.svg` används oförändrad på ljus bricka, märkt OpenAI.
  `dots.svg` borttagen; `SOURCES.md` uppdaterad. Inga andra filer borttagna.
- Befintligt bildskripts scenlocator och animationsögonblick uppdaterade.

Verifiering i denna revision: `npm run lint`, `npx tsc --noEmit` och
`git diff --check` PASS. Båda språkversionernas komponent renderades till statisk
HTML i en isolerad Node-kontroll utan Next-server, miljöfiler eller databas.
Chromium kunde inte starta (`sandbox_host_linux.cc:41`, `Operation not permitted`);
visuell granskning, viewportkontroller och interaktionsprov är därför NOT RUN.
Ingen produktionsbuild eller databastest körd. Ingen port bunden.

Modern Web Guidance: CLI-sökning blockerad av EAI_AGAIN/ENOTCACHED; den lokala
medföljande `guides/ui-behaviors/motion.md` lästes. Animationer aktiveras endast
under `prefers-reduced-motion: no-preference`, slutläget är synligt utan rörelse.

Lokal commit blockerad: Git kunde inte skapa worktreets `index.lock` eftersom
Git-metadata ligger på skrivskyddat filsystem. Ingen commit/staging kunde göras;
alla ändringar inklusive den tillhandahållna OpenAI-filen måste tas med i din
lokala commit. Inga försök att kringgå filsystemsskyddet. Ingen push, merge,
PR eller deploy. Inga miljöfiler/hemligheter lästa eller ändrade. Endast syntetiskt
innehåll. Ingen annan worktree eller runtime ändrad.

---

# Landing — lokal leveransrapport, 2026-11-15

Implementerad på befintlig `codex/landing`, bas `bf7b6c3`. Inte slutverifierad:
build, skärmbilder och commit är blockerade enligt nedan. Ingen push/merge/PR/deploy.

## Filer och beteende

- `src/pages/landing.tsx`: separat `/landing` i Pages Router, automatiskt statisk
  enligt installerad Next-dokumentation. Undviker App Routers befintliga
  layout, språk-/cookiehantering och databasberoenden. Inga andra routes ändrade.
- `src/pages/landing.module.css`: isolerad benvit/grön layout, mobilanpassning,
  12-sekunders CSS-loop med fyra logotyper, kalenderplatser och bokningskvitton.
  Minskad rörelse ger statisk bild; pausreglaget pausar även demoflödet.
- `public/landing/logos/{grok-bot,muse,dots,claude}.svg` och `SOURCES.md`:
  befintliga tillhandahållna filer bevarade oförändrade, använda direkt.
- `scripts/capture-landing.mjs`: lokalt bildskript för 1440, 390 och en
  animationsbild, med kontroller av överflöde, logotyper, paus, minskad rörelse,
  ankarlänk, webbläsarfel och frånvaro av API-/externa anrop.
- Denna rapport.

Svensk copy enligt uppdraget. Illustrationsnotisen finns under scenen.
Serverkontroll av kundmandat och Valei/Bokadirekt ligger endast under Senare.
Feed och DEMO-id:n är lokala syntetiska exempel, inte verkliga bokningar.
Inga nya paket, fjärrhämtade typsnitt, formulär, API-anrop eller databasanrop.
Ingen `.env` eller hemlighet har lästs.

## Exakta kontrollutfall

`npm run lint`, exit 0, slutlig körning:

```text
> booking-lab-se@0.1.0 lint
> eslint .
```

`npx tsc --noEmit`, exit 0, slutlig körning: ingen output.

Första typecheck misslyckades eftersom genererad Prisma-klient saknades.
Klienten genererades endast i `node_modules`, från `/tmp` med explicit
schemasökväg, så projektets Prisma-konfiguration som läser `.env` aldrig kördes:

```text
Prisma schema loaded from ../workspace/booking-lab/landing-wt/prisma/schema.prisma.
✔ Generated Prisma Client (v7.10.1) to ./../workspace/booking-lab/landing-wt/node_modules/@prisma/client in 141ms
```

`npm run build` (Turbopack) stannade vid `Creating an optimized production build ...`;
avbruten med exit 130. Separat försök `npm run build -- --webpack`, exit 1:

```text
> booking-lab-se@0.1.0 build
> next build --webpack

▲ Next.js 16.4.6 (webpack)
✓ Running next.config.ts took 33ms

  Creating an optimized production build ...

> Build error occurred
Error: Could not parse output from TypeScript's --showConfig.
    at ignore-listed frames {
  type: 'Error'
}
```

Isolerad kontroll av Nexts TypeScript-hjälpare gav exit 0 men tom stdout/stderr.
Direkt `tsc --showConfig` gav JSON. Ingen ändring av Next eller testkrav gjord.
`node --check scripts/capture-landing.mjs` och `git diff --check`: exit 0, ingen output.
Databas-/integrationstester är inte körda för denna isolerade statiska sida.

## Blockeringar och osäkerhet

- Socket-wrapper utan `.env`, `PORT=3199 node scripts/server.mjs --dev`:
  `Error: listen EPERM: operation not permitted 127.0.0.1:3199`.
- Chromium startar inte: `FATAL:content/browser/sandbox_host_linux.cc:41`
  och `shutdown: Operation not permitted (1)`. WebKit saknar systembibliotek.
- Begärd bildmapp: `mkdir: cannot create directory
  ‘/workspace/booking-lab/landing-shots’: Read-only file system`.
- Inga skärmbilder skapade eller granskade. Mobil layout och animationspositioner
  är därför inte visuellt verifierade. Bildskriptets syntax är verifierad;
  dess webbläsarkontroller är ännu inte körda.
- `git add` nekas: `fatal: Unable to create
  '/tmp/bl-agent-api/.git/worktrees/landing-wt/index.lock': Read-only file system`.
  Ingen ny commit eller commit-hash finns; samtliga nya filer inklusive logotyper
  behöver läggas till när Git-metadata är skrivbar.
- Modern Web Guidance söktes för tillgängliga CSS-animationer. Nätförsöket gav
  `EAI_AGAIN registry.npmjs.org`; offlineförsöket gav `ENOTCACHED`.
  Ingen guide kunde hämtas.

## Återstående körning i en miljö som tillåter server, Chromium och Git

Kör lint/typecheck/build igen. Efter godkänt bygge, starta den befintliga
socket-wrappern utan `.env` med `PORT=3199 node scripts/server.mjs`.
Kör `node scripts/capture-landing.mjs`, granska de tre bilderna i begärd mapp,
rätta eventuella visuella fel och gör den begärda lokala commiten inklusive logofiler.
Detta är återstående verifiering, inte ett uppnått DONE-resultat.
