# CI-bevis — Epic 05 levererad till privat branch

2026-11-12. Kod granskad av Grok: **4fc98d37fef805e041f8f8772a3fc37543d4ff04**. Pushad och CI-testad revision: **c12b98a31f844f4dc50213a72feb57db02595794**, branch **epic-05-booking-workspace**. Mellan dessa revisioner ändras bara Markdown. Codex läste jobbstatus och faktiska loggar, verifierade headSha och sparade råutdata lokalt. Efterföljande dokumentcommits beskriver dessa körningar; de är inte nya produktrevisioner. Ingen mainmerge/deploy.

## Faktiska körningar

| Händelse / körning | Resultat |
| --- | --- |
| [Feature-push43209758207](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43209758207) | **PASS, ett jobb** dev/proxy0. Jobb131154051482 start11:30:41Z, slut11:34:42Z: **4m01s** inklusive kall npm-/browsercache. Mål≤5min uppfyllt i denna observation, ingen generell tids-/kostnadsgaranti. |
| [Manuell fullmatris43210413097](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43210413097) | **PASS, exakt fyra jobb**, alla på c12b98a. Startades efter färdig feature-körning; ingen körning avbröts för att dölja fel. |

| Manuellt jobb | Jobb-ID | Verklig E2E-utdata | Hela jobbets tid |
| --- | --- | --- | --- |
| dev / proxy0 | 131156267664 | 24 passed (1.3m) | 3m59s |
| dev / proxy1 | 131156266909 | 24 passed (1.2m) | 2m45s |
| production / proxy0 | 131156267367 | 24 passed (36.7s) | 2m05s |
| production / proxy1 | 131156267291 | 24 passed (36.7s) | 2m12s |

Dev/proxy0 har även lint, **69/69 unit**, **66/66 integration** och typkontroll PASS. Alla fyra körde ren npmci, Prisma generate7.10.1, fem migrationer och seed på ny booking_ci_test, build, E2E och tsc. Ubuntu26.04.1, Node24.22.2/npm11.19.1; PostgreSQL16-image via befintlig Docker Compose. Detta provar databascontainern och appen på runnerns Node, inte en komplett distributionsimage eller riktig TLS/proxy.

Feature-loggens exakta utdrag: `added 571 packages, and audited 572 packages in 54s`; `Generated Prisma Client (v7.10.1)`; `5 migrations found`; `All migrations have been successfully applied`; `69 passed (69)`; `66 passed (66)`; `24 passed (58.3s)`. Windows installerade570/571 och Linux571/572; Git och QA har verifierat identisk lockfil. Antalen avser olika plattformar/npm-versioner och är inte bevis för ett tillagt projektberoende. ESLint-deprecation och npm-varningar om tre ej allowScripts-listade installskript finns i loggen; inget undertrycktes och inga beroenden/overrides ändrades.

## CI-kostnadsacceptans och kvarstående gränser

- Feature körde verkligen ett jobb och tog4m01s med kall cache. Ingen påstådd omräkning av alla tidigare10docs-körningar.
- Manuellt kördes verkligen hela fyrfältsmatrisen på samma SHA och alla jobb blev gröna. Main-villkoret är kodläst men ingen mainpush/merge gjordes.
- Npm- och Playwright-cache fick **hit i samtliga fyra manuella jobb**; browserinstallationen hoppades över, OS-beroenden installerades fortsatt. Kall feature-körning sparade båda cacharna. Ingen node_modules-/secretcache.
- **Docs-only PASS:** pushen7e8f9013023d6e92f04cef805743a70065fa3b52 ändrade endast Markdown och gav0Actions-körningar i API-kontrollen efter push. Båda senaste verifieringskörningarna gäller fortsattc12b98a. Senare dokumentation är ingen ny kodrevision och beställer ingen ny fullmatris. PR-dublettvillkor och concurrency är syntax-/kodgranskade, men separat PR-/avbrottsprov är NOT RUN; ingen onödig PR skapades.
- Full audit är fortfarande **FAIL,7 moderate/0 high/critical**; produktionsaudit **PASS,0**. Verify POC kör inte längre ett separat auditjobb per push enligt uttrycklig kostnadsbeställning. Grönt Verify är därför inte noll advisories eller pilot-GO.
- `.github/workflows/dependency-audit.yml` finns på branch: måndag06:00 Europe/Stockholm och manuellt läge, full-audit-utfall rapporteras separat och high/critical är jobbegränsningen. **Schema/runtime NOT RUN och inte aktivt**, eftersom workflow saknas på default-branchen main. Aktivering kräver ett framtida uttryckligt tillåtet mainbeslut; det genomförs inte här. Inga riskabla majoruppgraderingar/overrides infördes för minimatch.

Main är fortsatt **b000481e547f1c5ede5f6487a65b721da8f044ee**. Privat synlighet och pushbehörighet verifierades genom GitHubconnector före push. Fullmatrisens status/loggar lästes för exakt c12b98a, inte bara en grön branchbadge. Lokala råbevis: booking-lab-pg-test/epic05-ci-feature-job.log, epic05-ci-full-job-<id>.log och epic05-ci-full-jobs.json. Syntetiska testuppgifter; inga råloggar eller artefakter i Git.

## Bilaga — tidigare Epic02–04-bevis

# CI-bevis vid branchleverans — 2026-11-12

Codex läste både jobbstatus och loggar efter respektive godkänd push. Alla granskade revisionsnummer nedan matchar körningens headSha. **De fyra E2E-jobben är gröna; helhetsstatus är failure på grund av separat känt audit-jobb.** Ingen merge till main eller deploy.

| Branch / verifierad leverans | Actions-körning | Faktiskt resultat |
| --- | --- | --- |
| epic-02-local-agent-booking / dba05a2d3994e84e78ae2997faba06015bba4eaa | [43168794400](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43168794400) | Fyra E2E-jobb success. Audit failure:3 höga/7 måttliga på denna äldre revision. |
| epic-03-dependency-security / 10175ed6c4eabbc357b361cdd3419856ab28f868 | [43169125103](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43169125103) | Fyra E2E-jobb success. Audit failure:0 höga/7 måttliga. |
| epic-04-individual-admin / 199d3260da20e8a18b990f82eabb54a007b40e79 | [43172522203](https://github.com/niclasvestlund-YT/booking-lab-se/actions/runs/43172522203) | Fyra E2E-jobb success,14/14 vardera. Unit61/61 och integration40/40 i dev/proxy0. Audit failure:0 höga/7 måttliga. |

Epic04 E2E-utdata: dev/proxy0 **14 passed(32.6s)**, dev/proxy1 **14 passed(25.7s)**, production/proxy0 **14 passed(18.6s)**, production/proxy1 **14 passed(19.3s)**. Lint, build och tsc-jobbsteg success. Underliggande produktkod är471f91f;199d326 ändrar bara dokument ovanpå den.

Detta dokument levereras i en senare dokumentcommit. Det intygar körningarna ovan, inte en okörd framtida revision. Senaste branchstatus finns i [Epic04 Actions](https://github.com/niclasvestlund-YT/booking-lab-se/actions?query=branch%3Aepic-04-individual-admin); efterföljande dokumentpush kontrolleras också vid överlämningen. Inga manuella omkörningar eller undertryckta audit-fel användes för att få gröna testjobb.

Privat remote verifierad före push och efter leverans. main är fortsatt b000481e547f1c5ede5f6487a65b721da8f044ee. Lokala råbevis epic02-ci-final.json,epic03-ci-final.json,epic04-ci-final.json/log ligger i det separata testverktygsområdet och innehåller inga produktionsuppgifter. Docker Compose har nu körts i Ubuntu-CI; lokal Windows-Docker, riktig TLS/proxy och flerinstansdrift är fortfarande inte verifierade. Groks lokala Linuxprober ersätter inte sådan driftverifiering.
