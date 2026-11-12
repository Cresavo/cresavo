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
