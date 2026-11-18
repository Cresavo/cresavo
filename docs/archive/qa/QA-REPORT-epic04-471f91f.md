# QA-rapport — Epic 04 fixvarv 1 (E04-QA-1) — 471f91f

**Granskare:** Booking Lab QA (Grok Bot), read-only
**Datum:** 2026-11-12, 07:55–07:59 CET (Europe/Stockholm)
**Revision:** `471f91fa11ad27c19ecd43244bcc90ba3f0b2489`
**Miljö:** `/workspace/qa/booking-lab-se/run-471f91f/`, egen embedded-postgres på port **55551** med `timezone=Europe/Stockholm`, prodserver på 3310 med `TRUST_PROXY_IP=1` (betrodd proxy 127.0.0.10). Bara syntetiska data. Ingen kodändring, inga commits, inget på PC:n.

**Utfall:** E04-QA-1 är **STÄNGD**. Inga nya fynd. **Lokal POC: GO. Pilot: NO-GO.** Ingen FIX-REQUEST.

## 1. Revision och diff — PASS

- ZIP SHA256 `7374784ffa8cc5c48f9e9ac44756609d666ff6d01d1b20141e316e67f674d94a` och zip-kommentaren `471f91fa…` stämmer. Bara `.env.example`, ingen `.env` och inga `node_modules`.
- `diff -rq` mot min CRLF-normaliserade 3419973-tree visar produktändringar **bara** i `src/lib/errors.ts`, `src/lib/password.ts` och `src/lib/rate-limit.ts`, teständringar bara i `tests/password.test.ts` och `tests/security.test.ts`, resten är docs.
- `package.json` och `package-lock.json` är byte-identiska. Bokning, session, migrationer och scripts är oförändrade.

## 2. Kodgranskning — PASS

- `PasswordCapacityError extends DomainError` har samma text, 429 och Retry-After 1. `passwordSlot` kastar den bara vid `running>=4`, före `running++` och före KDF.
- `checkLoginAttempt`:
  - Spärrkontroll och reservation sker fortfarande synkront före `await verify()`.
  - Spärrad klient ger en vanlig `DomainError` innan `reservation` sätts, alltså ingen refund.
  - Refund görs bara vid `instanceof PasswordCapacityError`, på det **fångade originalobjektet**. Nyckeln är `login:${ip}` med samma `/64`-nyckel som `clientLimitKey` gav vid reservationen, alltså rätt bucket.
  - Varje request ökar räknaren högst en gång och minskar den högst en gång, så dubbelräkning eller negativa värden kan inte uppstå: success-grenen och catch-grenen utesluter varandra.
- Kapacitetsfelet uppstår innan någon KDF körts, och login-vägen har bara ett anrop till `passwordSlot`. Varje återlämnad reservation motsvarar alltså en gissning som aldrig prövades.
- Andra fel (DB-fel, korrupt hash, andra 429) återlämnas inte. `finally` behåller 100 ms-fördröjningen.

## 3. Körda kommandon (ren installation)

| Steg | Resultat |
|---|---|
| `npm ci` | PASS, 571 paket |
| `npx prisma generate`, `npm run db:migrate` (4), `npm run db:seed` | PASS |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` | PASS |
| `npm test` | **61/61** PASS. Inkluderar de tre nya refund-testerna och kravet på exakt feltyp i kapacitetstestet. |
| `npm run test:integration` (1 gång) | **40/40** PASS |
| E2E, audit, full matris | **NOT RUN** (inte begärt; basen är 3419973-matrisen) |

## 4. Prober mot prodbuild med KDF-hook (harness-only `--require`)

| Kontroll | Kommando/repro | Resultat |
|---|---|---|
| **E04-QA-1-repro** | `node probes/p-limit2.mjs`: 40 olika IPv4 floodar, offret loggar in med rätt lösenord i 5 vågor | Under floden: `200`, sedan 4×`429/Retry-After 1` (kortvarig kapacitetsmättnad, dokumenterad). **Efter floden: 200** (tidigare `429/Retry-After 898`). En annan klient: 200. **PASS** |
| 10 kapacitetsavslag, sedan rätt login | `p-limit3.mjs` (a) | 10/10 avslag gav `429/ra=1`. Rätt login efteråt: **200**. **PASS** |
| 4 fel + 6 kapacitetsavslag + rätt | `p-limit3b.mjs` (b) | 4×401, 6×`429/ra=1`, rätt: **200** (4 verkliga fel < 5, enligt design). **PASS** |
| 4 fel + 6 kapacitet + 1 fel, sedan rätt | `p-limit3b.mjs` (b2) | Det femte verkliga felet gav 401. Rätt lösenord efteråt: **429/ra=898**, utan refund av verkliga fel. **PASS** |
| 2 fel, 3 kapacitet, 3 fel (5 verkliga) | `p-limit3.mjs` (c) | Rätt lösenord två gånger: **429/ra=899, 0 KDF**. Spärrad klient nekas före verifiering. **PASS** |
| Refund-missbruk: X skickar 80 gissningar i skurar om 8 under flod | `p-limit3.mjs` (d) | X fick bara **2 verkliga verifieringar** (401), övriga 429. Under pågående reservationer syns tillfälligt `429/ra=900`, sedan rätt login 200. **Aldrig mer än 5 KDF per klient.** **PASS** |
| 300 samtidiga gissningar från en klient | `p-limit.mjs` L1 | 5×401 + 295×429, **5 KDF (≤5)**. Rätt lösenord från samma klient: **429/900 utan KDF**. En annan klient: 200. Spoofad `X-Real-IP` från opålitlig peer ignoreras. **PASS** |
| IPv6 inom samma /64 (300 gissningar) | L3 | **5 KDF**. **PASS** |
| Max 4 samtidiga och ingen kö | L4 + (e) | Peak **4**, running 0 efteråt. 40 samtidiga gav 5×401 + 35×429. Sedan 6 sekventiella korrekta login = 200. **PASS** |
| Minsta fördröjning | L1 / (e) | Minsta svarstid 443 ms respektive 137 ms, båda ≥100 ms. **PASS** |
| Felväg (korrupt hash, inte kapacitet) | L5 | 5×500 `Ett fel inträffade` + 3×429 från limitern, alltså **räknas, refunderas inte**. `threw` = 5, running = 0, sedan 6×200. Loggen visar bara `BOOKING_INTERNAL_ERROR`. **PASS** (E04-QA-3 kvarstår som idé) |
| Bucket-eviktion | Kodläsning + unit-testet "evikterad reservation" (10 001 buckets) | Refunden landar på det evikterade objektet, och en ny buckets spärr ligger kvar. **VERIFIED** på kod- och unitnivå. Över HTTP **NOT RUN**: tidsfönstret kan inte styras deterministiskt. |
| Läckor | Serverlogg i alla prober | Inga lösenord, inget `$argon2`. **PASS** |

**Notering (ingen ny finding):** under samtidiga skurar från samma klient kan Retry-After visa 900 fast spärren bara gäller medan reservationerna pågår. Det följer av den avsiktliga reservationen före await och fanns redan före fixen.

## 5. Fynd

| ID | Status |
|---|---|
| **E04-QA-1** | **STÄNGD.** Kapacitetsavslag förbrukar inte längre klientens kvot. Refund går bara till rätt originalbucket. Ingen klient får fler än 5 verkliga verifieringar per fönster. |
| E04-QA-2…5 | Oförändrade. Dokumenterade framtida grindar/pilotgrindar (kvot per konto, korrupt hash ger 500, native-licensinventering, port 3000). |
| Nya | Inga. |

## 6. Bedömning och städning

- **Lokal POC: GO. Pilot: NO-GO**, oförändrat: MFA, GDPR, TLS och distribuerat missbruksskydd (E04-QA-2), native-licensinventering.
- PostgreSQL på 55551 och alla prodservrar är stoppade. Portarna 55551, 3000, 3310 och 3311 är stängda och inga processer är kvar.
