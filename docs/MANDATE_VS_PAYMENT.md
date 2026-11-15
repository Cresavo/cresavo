# Mandat och betalning

Gatewayen tar inte betalt. Tre separata lager gäller:

1. Agentens API-nyckel eller OAuth-access-token identifierar klienten och ger
   scopes. Identitet och `bookings:write` utfärdar inget kundmandat.
2. Kundens Ja till serverns exakta förslag skapar ett bokningsmandat med tjänst,
   tid, personal, serverhärledd plats/schema, pristak, utgång och klient.
   `maxPriceOre` begränsar bokningen; det är ingen debitering eller betalningsrätt.
   Operatörens syntetiska testhjälp är ett separat, uttryckligt testursprung.
3. Ett eventuellt framtida betalningstoken är ett eget objekt. Typkontraktet
   `PaymentAuthorizationToken` i `src/lib/agent-api/payment-contract.ts` kräver
   `mandateId` som referens. En framtida implementation måste verifiera att
   mandatet finns och kräva separat betalningsauktorisation. Typen utfärdar
   ingenting och en strängreferens bevisar inte att ett mandat finns.

Mandatet får aldrig bära kortnummer, payment-token, checkout-session,
payment-intent, charge-id eller andra betalningsuppgifter. `StoredMandate` och
`AgentMandate` saknar sådana fält. De strikta mandat-, förslags- och
bokningsschemana avvisar okända betalningsfält. Betalningskontraktet är enbart
ett TypeScript-interface, utan runtime-export, issuer, lagring, provider,
HTTP-rutt eller konvertering från mandat. Ingen betalning eller Epic 02 ingår.
