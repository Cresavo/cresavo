# Epic 04 — begränsat QA-rättningsvarv1

2026-11-12. Grok godkände3419973 som lokal POC efter full egen matris:58unit,40integration×3,14E2E×4; [originalrapport](qa/QA-REPORT-epic04-3419973.md). Inga blockerare, men E04-QA-1 rekommenderades före push.

## E04-QA-1 — kapacitetsavslag ska inte bli lösenordsgissningar

Verifierad orsak i koden: per-klientreservation behölls när den globala fyrplatsgränsen nekade utan KDF. Upprepade korta kapacitetsavslag kunde därmed bli15minuters klientspärr efter att överbelastningen upphört.

Tillför en specifik PasswordCapacityError under befintlig DomainError, samma statiska429/text/Retry-After1. Endast denna typ återlämnar den egna ursprungliga reservationen. Reservation görs fortfarande före await och före verifiering. Verkliga fel, andra429, undantag och redan spärrade klienter får ingen återbetalning. Refund till en evikterad buckets objekt får inte sänka en ny buckets räknare. Minst100ms fördröjning och max4KDF/ingen kö behålls. Inget boknings-, sessions-, schema- eller beroendebeslut ändras.

Nya regressioner: åtta kapacitetsavslag följt av korrekt login; fyra verkliga fel plus sex kapacitetsavslag och ett annat429 fyller fortfarande verkliga femförsöksgränsen; evikterad reservation påverkar inte ny bucket. Nativekapacitetstestet kräver den specifika feltypen. Första testkörningen fångade en för exakt testförväntan på900sekunder: verkligt korrekt899 efter testets fördröjning. Testet ändrades till numerisk Retry-After; inga produkttider ändrades.

Slutmatris PASS efter fix:61unit,40integration,14E2E×4,lint/tsc/build/cleanup och aggregat0. Grok stängde E04-QA-1 efter riktade verkliga prod/proxy/flodprober på471f91f; inga nya fynd. [Slutrapport](qa/QA-REPORT-epic04-471f91f.md). Ingen ny video behövs för detta osynliga rättningsvarv; produktionsdemo9282cdc är märkt som äldre än limiterfixen.

## Kvarstående fynd

- E04-QA-2: ingen kontobunden/distribuerad gissningsgräns. Känd pilotgrind; kräver genomtänkt skydd mot riktad kontolåsning och MFA, inte en extra blind kontobucket i denna fix.
- E04-QA-3: korrupt DB-hash med giltigt prefix ger sanerad500. Kräver lagringskorruption/DB-manipulation; ingen behörighetsgenväg eller läcka observerad. Framtida robusthet.
- E04-QA-4: Linuxnativepaketet saknar LICENSE-fil; statiskt länkade Rust-crates behöver komplett inventering före distribution. Ingen binär/container distribueras.
- E04-QA-5: fast lokal Playwrightport3000; kör en miljö åt gången. Inget ramverk för parallell drift tillförs.

MFA, kund-GDPR, faktisk TLS/proxy/flerinstansdrift och övriga distributions-/auditgrindar kvar. Pilot fortsattNO-GO.
