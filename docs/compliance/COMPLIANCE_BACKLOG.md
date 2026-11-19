# Cresavo compliance backlog

**This is not legal advice.** Swedish and EU launch planning, checked 19 November 2026. Items
marked **(verify with a lawyer)** need a decision for the actual service, contract or deployment
before the relevant feature goes live.

The concept demo uses fictional data and simulated integrations. The first real pilot, including
an unpaid pilot, needs the core checks below. **P0** means before any real pilot. **P1** means
before enabling the relevant feature or onboarding an in-scope business. **P2** means monitor
and reassess before a change in scope. Effort is a planning estimate covering implementation and
operational setup. **S** is mainly configuration, documentation or review, **M** is a product
workflow or integration, and **L** spans several systems or a dedicated module.

## Summary

| Regime | Applies to whom | Product requirements | Before-live checklist item | Effort | Priority |
| --- | --- | --- | --- | --- | --- |
| GDPR and IMY guidance | Salon or clinic as controller, hosted Cresavo as processor for bookings and controller for its own purposes | Privacy notices, rights, retention, incident support, provider and transfer controls | Sign the DPA, approve data flows and test rights and breach response | L | P0 |
| Health data and patient records | Any controller handling health data, regulated care and aesthetic providers for patient records, Cresavo on their instructions | Restricted records, audit trails, retention and clinical safeguards | Exclude health data from the core pilot and approve a separate rollout | L | P0 exclusion / P1 enablement |
| Electronic commerce and consumer contracts | Salon or clinic as seller, Cresavo for its own online service and any extra sales role it takes | Seller identity, VAT-inclusive prices, terms, confirmation, withdrawal and fee controls | Review Swedish terms and test the booking-to-refund journey | M | P0 / P1 for optional fees |
| Direct marketing and reviews | Salon for its campaigns and reviews, Cresavo for its own and potentially shared publishing activities | Consent and opt-out, suppression, review provenance and verification disclosure | Test eligibility, opt-out and review moderation before activation | M | P1 |
| Cookies and terminal access | Site operator and parties deploying trackers on each host | Tracker inventory, prior consent and accessible preferences | Audit every pilot host and block optional tracking by default | M | P0 |
| Payments and SCA | Licensed or otherwise authorised PSP, salon as merchant, Cresavo as technical integrator | Hosted checkout, direct settlement, refunds, dispute handling and reconciliation | Approve the funds flow and exercise failure and refund cases | M | P1 |
| Cash registers and receipts | Salon or clinic that takes covered payments, Cresavo if it supplies a register product | Distinguish concluded distance sales from on-site sales, integrate compliant POS or direct staff to it | Confirm receipt and register treatment for each payment flow | M | P1 |
| Bookkeeping, VAT and vouchers | Salon for its books and taxes, Cresavo for its own and for contracted finance features | Traceable transactions, records export, service VAT and voucher classification | Get accountant approval and test reconciliation and imports | M | P1 |
| Accessibility (EAA) | Providers of covered consumer services, subject to the service microenterprise exemption | Accessible booking, withdrawal, payment and support, compliance information where required | Test the full booking flow and document responsibility by operator | M | P0 |
| Security and NIS2 | Cresavo and salon under GDPR as applicable, covered operators under Swedish cybersecurity law | Tenant isolation, secure access, recovery and incident response | Pass the pilot security gate and record a NIS2 scope decision | L | P0 / P2 reassessment |
| EU AI Act | AI-system provider and salon or other deployer, depending on the integration | First-contact disclosure, bounded authority and minimal audit records | Classify each live AI flow and test disclosures and authorisation | M | P1 |
| SMS sender identity | Salon as sender, Cresavo as integrator and its providers as applicable | Verified sender IDs, provider-specific registration and working opt-out | Verify Swedish routing and current PTS and provider requirements | S | P1 |
| AGPL and trademark | Cresavo and downstream hosts and distributors according to their activity | Corresponding Source, notices and brand policy | Test hosted source access and audit distributed artefacts | S | P0 |

## GDPR and IMY guidance

- **Roles.** The salon or clinic normally decides why it uses customer and booking data and is
  the controller. Hosted Cresavo is its processor for instructed processing. Cresavo is a
  controller where it determines its own purposes, such as its own billing, marketing and
  associated account records. In a self-hosted deployment the operator normally controls booking
  data. Map any Cresavo support access, telemetry or hosted add-ons separately. Assess joint
  control or independent control if parties choose purposes together or reuse customer data, and
  classify PSPs and agent operators by what they actually do (verify with a lawyer). [GDPR, Articles 4, 26 and 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/) · [IMY guidance for processors](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsansvariga-och-personuppgiftsbitraden/att-tanka-pa-som-personuppgiftsbitrade)
- **DPA (PUB-avtal).** Sign an Article 28 data processing agreement describing purposes,
  duration, data and people covered, instructions, confidentiality, security, audit rights,
  assistance with rights and breaches, and return or deletion at exit. Get prior specific or
  general written authorisation for subprocessors. Under general authorisation, notify the salon
  in advance of additions or replacements and allow objections. Flow equivalent obligations down
  and keep a dated register identifying hosting, backups, messaging, AI and support providers,
  their roles and processing locations. [IMY on processing agreements](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/personuppgiftsansvariga-och-personuppgiftsbitraden/personuppgiftsbitradesavtal/)
- **Legal bases and notices.** Each controller records an Article 6 basis by purpose. Common
  candidates include contractual necessity for booking and steps requested before contracting,
  legal obligation for required accounting, and a documented legitimate-interest assessment
  where appropriate for fraud/security and some communications. Use valid consent where
  required, with separate marketing and tracking choices. The controller provides Articles 13–14
  information at collection or on the applicable indirect-collection timetable, including
  purposes, recipients, transfers, retention and rights. Health data also requires an Article 9
  exception. [GDPR, Articles 5–7, 9, 13–14 and 30](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- **Retention and rights.** Support per-purpose retention and automated deletion or effective
  anonymisation across live records, exports, integrations and logs. Document backup expiry and
  reapply deletions after restores. Protect legally required records from ordinary deletion and
  restrict access. Verify identity proportionately and route requests to the controller. Support
  access and copies, correction, erasure, restriction, objections and machine-readable
  portability where Article 20 applies. The usual response deadline is one month, with up to two
  extra months where justified and notice within the first month. Salon offboarding export is a
  separate workflow. [GDPR, Articles 5 and 12–22](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/) · [IMY deadlines](https://www.imy.se/privatperson/dataskydd/dina-rattigheter/galler-for-alla-rattigheterna/tidsfrister)
- **Incidents.** Cresavo as processor informs the controller without undue delay after learning
  of a personal-data breach. The controller documents every breach, reports to IMY within 72
  hours of awareness where feasible unless risk to people is unlikely, and informs affected
  people without undue delay where high risk requires it. Cresavo handles the controller duties
  for its own processing. Keep a contact tree, timeline, risk assessment, tenant impact and
  notification templates. [GDPR, Articles 33–34](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/) · [IMY on reporting breaches](https://www.imy.se/vanliga-fragor-och-svar/nar-ska-vi-anmala-personuppgiftsincidenten-till-IMY/)
- **DPIA.** Screen new flows before processing. A DPIA is mandatory for likely high risk,
  including large-scale special-category processing, systematic extensive automated evaluation
  supporting significant decisions, and large-scale systematic monitoring of publicly accessible
  areas. Check IMY's list and criteria for combined risks such as health data, vulnerable
  people, profiling and new technology. The controller owns the assessment and consults IMY
  before processing if high residual risk remains. Cresavo supplies architecture, data flows and
  safeguards. Assess the need for a DPO as the operation scales. [GDPR, Articles 35–37](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/) · [IMY DPIA guidance](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/konsekvensbedomning/nar-ska-en-konsekvensbedomning-genomforas/)
- **International transfers.** Map actual recipients, onward transfers and remote access,
  including AI inference, provider logs and support. For a US recipient, verify that the exact
  entity has active EU–US Data Privacy Framework coverage for the data. Otherwise assess an
  appropriate Chapter V mechanism, typically the applicable standard contractual clauses, with a
  transfer impact assessment and supplementary safeguards as needed. Recheck adequacy and
  provider coverage before release. A bring-your-own key changes who contracts with the provider
  and must be mapped separately (verify with a lawyer). Minimise or redact prompts, review
  training and retention terms, and approve provider access before sending personal data. [IMY on US transfers](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/overforing-till-tredje-land/overforingar-till-usa/) ·
  [EU transfer clauses](https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj)
- [ ] **Before live.** Approve role and purpose maps, processing records, signed DPAs,
  subprocessor and transfer reviews, notices and retention schedules. Exercise one
  access/export, correction, deletion, restore, offboarding and breach scenario with test data.
  Complete DPIA screening and any required assessment before starting the processing.

## Health data, patient records and aesthetic treatments

- **Health data in any business.** Identifiable allergies, injuries, diabetes, medications,
  clinical images and appointment details that reveal health status can be Article 9 data even
  in a beauty, foot care, massage or skin business. A controller needs both an Article 6 basis
  and an applicable Article 9 exception. Explicit consent under Article 9(2)(a) is possible only
  where valid, freely given, specific and withdrawable. Article 9(2)(h) is for qualifying health
  or social care processing under applicable law or a contract with a health professional and
  the Article 9(3) secrecy safeguards. Review whether any proposed wellness collection is
  necessary and whether the business can rely on the proposed exception (verify with a lawyer).
  [GDPR, Articles 4, 7 and 9](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/) · [IMY guidance for healthcare providers](https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/vard/fragor-och-svar-om-personuppgifter-i-halso--och-sjukvarden--for-vardgivare/)
- **When patientdatalagen applies.** Assess the actual activity and provider. Medical
  prevention, investigation or treatment of disease or injury can be healthcare. IVO includes
  medical foot care in its provider-register classifications. A foot therapist's title or use of
  the word “journal” alone is insufficient to determine which rules apply. Verify the provider's
  status, duties and workflow for mixed businesses, such as medical foot care alongside
  pedicures or clinical care alongside wellness massage (verify with a lawyer). The provider
  remains controller and is responsible for clinical records and provider obligations. [Health and Medical Services Act](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/halso-och-sjukvardslag-201730_sfs-2017-30/) · [Patient Data Act](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/patientdatalag-2008355_sfs-2008-355/)
  · [IVO provider classification](https://www.ivo.se/globalassets/dokument/publikationer/register/koder-vid-anmalan-av-verksamhet-enligt-psl-2025-03-05.pdf)
- **Clinical record controls.** Provide identifiable authors, timestamps, required clinical
  fields, sign-off and traceable corrections preserving original entries. Restrict access by
  care need and enforce applicable MFA. Log reads and changes, retain access logs for at least
  five years, and support documented recurring reviews and controlled disclosures, including
  patient copies and access histories. Retain each journal record at least ten years from its
  last entry, with longer rules where applicable. Support patients with protected details or
  without a Swedish personal identity number. Route destruction requests through the special
  IVO process where relevant. Plan secure continuity and export when
  switching vendor or closing the clinic. [Patient Data Act, Chapters 3–4 and 8](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/patientdatalag-2008355_sfs-2008-355/) · [Socialstyrelsen journal and access rules, HSLF-FS 2016:40](https://www.socialstyrelsen.se/kunskapsstod-och-regler/regler-och-riktlinjer/foreskrifter-och-allmanna-rad/konsoliderade-foreskrifter/201640-om-journalforing-och-behandling-av-personuppgifter-i-halso--och-sjukvarden/)
- **Aesthetic surgery and injections.** Act 2021:363 brings covered professional procedures
  under the Patient Data, Patient Injury and Patient Safety Acts. The operator handles IVO
  registration and oversight, a designated manager, patient insurance, appropriately licensed
  practitioners and an age check (18+). Record oral and written information and treatment
  consent after the reflection period. Support at least seven days for surgery and two for
  injections. For the same type of injection repeated within six months, the regulation permits
  an exception to a new reflection period after the first treatment. Keep consultation,
  qualifying prior treatment and consent evidence, and keep cross-provider record access
  constrained by the law. [Act 2021:363, §§ 6–12](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2021363-om-estetiska-kirurgiska-ingrepp-och_sfs-2021-363/) · [Ordinance 2021:367, §§ 4–5](https://data.riksdagen.se/dokument/sfs-2021-367.html) · [IVO guidance](https://www.ivo.se/estetiska-behandlingar/)
- [ ] **Before a general salon pilot.** Disable health-intake fields, journal free text and
  clinical attachments. Review booking names, contact forms, messages and metadata for health
  disclosures. If health information arrives anyway, restrict it, prevent further propagation,
  notify the controller and follow its documented handling instructions and any
  record-preservation or incident duties.
- [ ] **Before enabling health or clinic workflows.** Record the provider's legal
  classification, Article 6 and 9 grounds, DPIA decision, confidentiality and outsourcing
  conditions (verify with a lawyer). Validate role access, encryption, journal logs, disclosure
  and retention with the provider. Keep health data out of general messages, analytics,
  marketing and AI flows unless specifically reviewed and authorised. For regulated aesthetic
  procedures test the consultation, cooling-off and consent sequence.

## E-commerce, consumer contracts and prices

- **Seller identity and ordering.** The salon normally contracts with the customer. Display the
  actual seller's name, establishment address, email and, where applicable, organisation and VAT
  numbers, supervisory authority and regulated profession information. Keep details easy to
  reach on both Cresavo and custom domains as applicable. Cresavo supplies its own applicable
  disclosures for its online service. Provide input correction, order steps and language
  information, storable terms and prompt electronic acknowledgement where required under §§
  10–13. If Cresavo introduces a marketplace, reassess the additional disclosure and allocation
  of responsibilities (verify with a lawyer). [Electronic Commerce Act (2002:562), §§ 8–14](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2002562-om-elektronisk-handel-och-andra_sfs-2002-562/) · [Distance Contracts Act (2005:59), Ch. 2](https://data.riksdagen.se/dokument/sfs-2005-59.html)
- **Distance contracts.** Identify when an organised online or phone booking actually forms a
  consumer contract. Show seller contact details, including phone, service details, total
  price and charges, payment and performance terms, complaints information and applicable
  withdrawal terms and standard form.
  Show any payment obligation before submission and obtain explicit acknowledgement through a
  clearly labelled action. Send the agreed details in a durable format, such as email. Preserve
  the terms version, price, timestamps and evidence of the customer's choices. [Distance Contracts Act, Ch. 2 §§ 2–10](https://data.riksdagen.se/dokument/sfs-2005-59.html) · [Konsumentverket business guidance](https://www.konsumentverket.se/marknadsratt-foretag/informationskrav-vid-distansavtal-regler-for-foretag)
- **Withdrawal and refunds.** The usual service deadline is 14 days from contract conclusion.
  Missing withdrawal information can extend the period. For performance during the period,
  capture the consumer's express early-start request and the required information for any
  proportionate charge. For a paid service, loss of the right after full performance requires
  prior express agreement to start and acknowledgement that the right ends on full performance.
  A covered website or app contract with a withdrawal right needs an easy-to-find withdrawal
  function available throughout the period since 19 June 2026, explicit confirmation of
  withdrawal, and a prompt time-stamped acknowledgement on a durable medium. Support statutory
  refunds without undue delay, generally within 14 days of notice, by the original method unless
  the consumer expressly agrees otherwise at no cost. Apply withdrawal exceptions only where the
  facts meet the statutory conditions. Classify healthcare, elective aesthetic services and
  unusual offerings individually (verify with a lawyer). [Distance Contracts Act, Ch. 2 §§ 10–15](https://data.riksdagen.se/dokument/sfs-2005-59.html) · [Konsumentverket on beauty treatments](https://www.konsumentverket.se/varor-och-tjanster/kopa-skonhetsbehandling-tips/) · [Konsumentverket on aesthetic procedures](https://www.konsumentverket.se/varor-och-tjanster/missnojd-med-skonhetsingrepp/)
- **Prices, cancellations, no-shows and deposits.** Display clear final consumer prices
  including VAT and mandatory charges, or how the price is calculated when a final price cannot
  be given. The Consumer Services Act (konsumenttjänstlagen) covers specified work on property
  and storage. Its §§ 42–43 govern cancellation compensation and reasonable predetermined
  charges within its scope. Konsumentverket says the Act does not directly govern ordinary
  beauty treatments. Its guidance for those treatments allows reasonable cancellation
  compensation reflecting what the appointment cost the business, potentially up to the full
  price on a late cancellation if the slot cannot be filled. Consumer terms must be fair and
  clear and additional payments require express approval. Disclose the fee, cutoff, deposit
  treatment and refund terms before booking. Prevent fee collection from overriding statutory
  withdrawal rights. State how the deposit counts toward the price or any lawful fee.
  Distinguish a deposit, preauthorisation and later charge. Allow staff to
  review, waive or refund, and give consumers a way to dispute a charge. Have counsel approve
  the circumstances and amount for no-shows, fee caps, deposit forfeiture and statutory
  exceptions (verify with a lawyer). [Price Information Act](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/prisinformationslag-2004347_sfs-2004-347/) · [Consumer Services Act, §§ 1 and 42–43](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/konsumenttjanstlag-1985716_sfs-1985-716/) · [Consumer Contract Terms Act, §§ 10–13](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-19941512-om-avtalsvillkor-i_sfs-1994-1512/) · [Konsumentverket on cancellation of beauty treatments](https://www.konsumentverket.se/varor-och-tjanster/kopa-skonhetsbehandling-tips/)
- [ ] **Before live.** Review Swedish seller disclosures, booking and cancellation terms and
  which events form a contract. Test the price shown to the customer, acknowledgement of payment
  obligations, durable confirmation, withdrawal and refund, including bookings inside 14 days.
  Keep optional deposits and fees off until merchant terms and collection flows pass review.

## Marketing, reviews and testimonials

- **Campaign SMS and email.** The salon is responsible for its campaigns and Cresavo for its
  own. Under §§ 19–20, obtain prior consent for electronic direct marketing to individuals
  unless the existing-customer exception applies. All conditions must hold: the contact was
  collected in connection with a sale, the customer did not object, marketing is for that
  seller's own similar products or services, and free, easy opt-out was offered at collection
  and in every message. Provide a valid opt-out address or mechanism, identify the advertiser
  and stop direct marketing on objection under GDPR Article 21. Record channel, purpose,
  wording, source and timestamp, suppress across retries and imported lists, and avoid including
  promotional copy in transactional confirmations or reminders. Assess review invitations by
  their actual purpose and content (verify with a lawyer). [Marketing Act, §§ 9 and 19–20](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/marknadsforingslag-2008486_sfs-2008-486/) · [IMY on objections](https://www.imy.se/vanliga-fragor-och-svar/kan-jag-begara-att-ett-foretag-ska-sluta-skicka-reklam-till-mig/)
- **Reviews and testimonials.** Whoever gives access to consumer reviews must explain whether
  and how they verify purchase or use. Take reasonable and proportionate steps before claiming
  reviews come from genuine customers. Fake or commissioned reviews or endorsements and
  misleading presentation are prohibited. Provide verified-visit evidence, label imported
  reviews and disclose how displayed scores or selections are compiled. Use consistent
  moderation, avoid review gating or selective suppression that misrepresents feedback, and
  handle publication permission and personal or health information in testimonials. Disclose
  incentives or commercial relationships where needed. [Marketing Act, § 12 c and § 4](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/marknadsforingslag-2008486_sfs-2008-486/) · [Omnibus Directive (EU) 2019/2161, review rules](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
- [ ] **Before live campaigns or reviews.** Test opt-in and qualifying existing-customer
  evidence separately, one-step opt-out and suppression on re-import, and transactional template
  previews. Publish the review verification explanation, test eligibility and moderation, and
  assign a contact for disputed or privacy-sensitive reviews.

## Cookies, terminal access and analytics

- **LEK 9:28.** Inform visitors and obtain consent before storing or retrieving information on
  their device unless it is needed solely for transmission or strictly necessary to deliver a
  service they explicitly requested. The rule covers cookies and equivalent local storage,
  pixels or identifiers when they store or access device information. Analytics cookies
  generally require consent. Where personal data is processed, assess GDPR roles, legal basis
  and disclosures separately. Review exactly what first-party or server-side analytics collects
  (verify with a lawyer). [Electronic Communications Act (2022:482), Ch. 9 § 28](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2022482-om-elektronisk-kommunikation_sfs-2022-482/) · [PTS cookie guidance](https://pts.se/internet-och-telefoni/kakor-cookies) · [PTS enforcement example](https://pts.se/contentassets/7b02c828f0984bfba1d1614dc666ab1a/underrattelse-folkhalsomyndigheten-kaktillsyn.pdf)
- **Product responsibility.** Map who deploys each tag on Cresavo and salon hosts. Gate optional
  scripts and embeds before they fire. Make refusal as easy as acceptance in the same view and
  withdrawal as easy as opt-in. Allow granular choices, keep consent evidence proportionate and
  disclose purposes, duration and third-party access. Keep tenant-installed embeds subject to
  the same controls.
- [ ] **Before live.** Audit a fresh browser session, refusal, acceptance and withdrawal on the
  product, booking and own-domain pages. Verify booking works with optional trackers refused and
  publish current notices.

## Payments, strong customer authentication and disputes

- **Roles and funds flow.** The salon is merchant and contracts with an authorised PSP, such as
  the relevant Stripe or Klarna entity, or uses Swish through its bank or acquiring partner.
  Verify the entity and permissions in the applicable register. Keep customer funds and payouts
  between PSP and merchant. No Cresavo custody, stored balance, pooled funds or onward payouts.
  The technical-services exclusion has conditions and does not cover payment initiation or
  account information services. Review the exact integration and any future marketplace, split
  payment, voucher network or stored-value model (verify with a lawyer). [Swedish Payment Services Act, Ch. 1 § 6](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2010751-om-betaltjanster_sfs-2010-751/) · [Finansinspektionen register](https://www.fi.se/sv/vara-register/foretagsregistret/) · [PSD2, Article 3(j)](https://eur-lex.europa.eu/eli/dir/2015/2366/oj)
- **Checkout and SCA.** Use PSP-hosted checkout or tokenised components and minimise PCI DSS
  scope with the acquirer. Keep card details out of app storage and logs. The PSP applies SCA
  for covered actions and determines exemptions, including handling authentication challenges
  and dynamic linking for remote electronic payments. For deposits and later off-session
  charges, record the customer's terms and mandate as applicable and follow the PSP's
  authentication and recovery flows (verify with a lawyer). [PSD2, Article 97](https://eur-lex.europa.eu/eli/dir/2015/2366/oj) · [SCA technical standards](https://eur-lex.europa.eu/eli/reg_del/2018/389/oj/eng)
- **Refunds and chargebacks.** Record booking, authorisation, capture, release, refund, dispute
  and settlement as distinct events. Verify PSP webhooks and handle duplicate, late or
  out-of-order events. Give authorised salon staff full or partial refunds, dispute alerts,
  deadlines and minimum necessary evidence, with no journal details sent by default. The salon
  owns statutory refunds and the PSP handles payment processing and scheme disputes. Prevent a
  chargeback and a refund from producing a duplicate reimbursement. Separate a PSP confirmation
  from the merchant's receipt or cash-register receipt.
- [ ] **Before live payments.** Approve a diagram showing direct settlement to the salon and
  confirm roles, refund terms, data flows and the authenticated checkout. Demonstrate success,
  failed or abandoned SCA, duplicated webhook, refund, dispute and reconciliation using the PSP
  sandbox. Review any buy-now-pay-later offer and applicable credit disclosures with the PSP
  (verify with a lawyer).

## Cash registers and receipts

- **Current Swedish rules.** The former Kassaregisterlagen is reflected in Chapter 39 of
  skatteförfarandelagen. On-site cash, card and equivalent electronic payments such as Swish
  generally require a compliant registered cash register unless an exemption applies. The
  low-volume exemption covers qualifying sales of at most four price base amounts including VAT
  in a 12-month financial year (SEK 236,800 in 2026). Where required, the merchant registers
  covered sales, offers a cash-register receipt on paper or electronically, and registers
  equipment with Skatteverket. The usual compliant setup is a manufacturer-declared register
  with a certified control unit (kontrollenhet) or applicable certified control system. From 1
  January 2027 use a register meeting SKVFS 2021:17, including XML export where it has journal
  memory. [Tax Procedure Act, Ch. 39 §§ 4–8 and Ch. 7](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/skatteforfarandelag-20111244_sfs-2011-1244/) · [Skatteverket register rules and 2027 update](https://www.skatteverket.se/foretag/drivaforetag/kassaregister.html) · [Skatteverket on exemptions](https://www.skatteverket.se/foretag/drivaforetag/kassaregister/vissaverksamheterarundantagnafrankravetpakassaregister.4.6efe6285127ab4f1d2580005105.html) · [Skatteverket on certified registers](https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/339826.html)
- **Distance sale versus payment at the salon.** A concluded distance sale under an organised
  distance-selling system can qualify for the exemption. For example, a specified treatment at
  an agreed price sold entirely through online checkout can qualify. A provisional booking with
  the sale agreed at the salon and paid by card or Swish there generally goes through the
  register. Where the binding sale was already concluded remotely, payment on site does not by
  itself determine the classification. A payment link or QR code used on site likewise does not
  establish a distance sale. Validate deposits, later balances, terminal checkout, add-ons, pay
  links and cancellations against the actual contract and point of sale (verify with a lawyer).
  [Skatteverket on distance contracts and registers](https://www4.skatteverket.se/rattsligvagledning/edition/2026.9/412764.html)
- **Product responsibility.** Keep sales channel, contract formation, payment method, VAT and
  receipt references traceable. For covered on-site sales route to compliant POS, through an
  integration or a documented staff handoff, and reconcile without duplicate entries. Cresavo
  owes vendor-side register compliance review if it offers its own register. A booking
  confirmation or card slip serves a different purpose from a required register receipt. Even
  exempt sales require bookkeeping evidence.
- [ ] **Before live payments.** Confirm the treatment of each channel with the merchant and
  Swedish tax adviser or Skatteverket. Prove the register handoff and customer receipt,
  including refunds and upgrades on site. Require the merchant to confirm its equipment or
  documented exemption before enabling on-site collection.

## Bookkeeping, SIE export and VAT

- **Bookkeeping.** Each business owns its books, including where it uses Cresavo data or
  outsources bookkeeping. Swedish law requires ongoing recording, verifications, traceable
  corrections and archiving. Required accounting information generally stays available through
  the end of the seventh year after the calendar year in which the financial year ended. Review
  location, access and any notification requirements if Cresavo is used as the accounting
  archive and stores records abroad (verify with a lawyer). Preserve dated verifications and
  links between sales, gross and net amounts, VAT, PSP fees, refunds, chargebacks and
  settlements. Provide readable records and underlying receipts for exit and audit. [Bookkeeping Act (1999:1078), Chapters 5 and 7](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/bokforingslag-19991078_sfs-1999-1078/) · [Bokföringsnämnden on archiving](https://www.bfn.se/fragor-och-svar/arkivering/)
- **SIE export.** SIE is a Swedish accounting interchange format. If transferring postings,
  implement the SIE 4 transaction export or the version agreed with the target accounting
  system. Include stable references, account and tax mappings, period, balanced entries and
  reversals. Make repeat exports identifiable to avoid duplicate posting. Supply verification
  documents separately where needed. [SIE-Gruppen format specification](https://sie.se/format/)
- **Service VAT.** Ordinary hairdressing, beauty and wellness massage are generally 25%.
  Qualifying healthcare and medically indicated foot care can be exempt under Swedish VAT rules.
  Treat aesthetic services performed solely for cosmetic purposes as generally taxable. Classify
  each service and distinguish exemption from a zero rate. Check how deposits, retained fees,
  no-shows, packages and mixed supplies are treated before automating tax (verify with a
  lawyer). [VAT Act (2023:200), Chapters 9–10](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskattelag-2023200_sfs-2023-200/) · [Skatteverket VAT rates and exemptions](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momssatserochundantagfranmoms)
- **Gift cards.** For a single-purpose voucher, the place of supply and amount of VAT on the
  underlying supply are known at issuance. For taxable supplies, account for VAT on the
  applicable transfer, including the initial sale, with no second VAT charge on redemption. A
  multi-purpose voucher leaves one of those facts undetermined and VAT on the underlying supply
  is accounted for on redemption. Classify by actual redemption terms, even for a single salon
  that offers both standard-rated and exempt services. Track issuer, sale, payment, partial
  redemption, balance, expiry, reversals and corresponding accounting entries. Display expiry
  and redemption terms and review online withdrawal and any multi-merchant design (verify with a
  lawyer). [VAT Act voucher provisions](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskattelag-2023200_sfs-2023-200/) · [Skatteverket voucher guidance](https://www4.skatteverket.se/rattsligvagledning/edition/2026.14/368428.html) · [Konsumentverket gift card guidance](https://www.konsumentverket.se/konsumentratt/presentkort-och-tillgodokvitto/)
- [ ] **Before live finance features.** Have a Swedish accountant approve sample service,
  deposit, refund and voucher entries. Reconcile a simulated month, verify statutory records
  remain exportable, and import any offered SIE export into a supported accounting system.

## Accessibility

- **Scope.** The EAA and Swedish Act (2023:254) have applied to covered consumer services since
  28 June 2025. An online booking journey aimed at concluding a consumer contract can be an
  e-commerce service even if payment happens later. Assess the public-facing service provider
  for each arrangement, typically the salon as seller, and Cresavo where it supplies a covered
  consumer service in its own capacity (verify with a lawyer). Service microenterprises are
  exempt if they have fewer than ten staff and annual turnover or annual balance sheet total no
  greater than EUR 2 million. Document the case for each provider, including linked enterprises
  where applicable. [EAA, Articles 2–4 and Annex I](https://eur-lex.europa.eu/eli/dir/2019/882/oj) · [Swedish Accessibility Act](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/) · [PTS scope FAQ](https://www.pts.se/digital-inkludering/lagen-om-vissa-produkters-och-tjansters-tillganglighet/vanliga-fragor-och-svar-om-tillganglighetslagen/)
- **Product baseline.** Use WCAG 2.1 AA and the relevant EN 301 549 criteria as acceptance
  criteria. Check PTS service requirements as well, including accessible service information and
  support and accessible identity, security and payments. The standard's web criteria cover only
  part of the EAA service obligations. Test end to end with keyboard and screen reader, zoom and
  mobile, including date selection, validation, consent, hosted checkout, cancellation and
  withdrawal. Make tenant themes and own-domain pages meet the same baseline. [Digg on WCAG 2.1 AA and EN 301 549](https://www.digg.se/kunskap-och-stod/regler-och-rekommendationer/regler-och-rekommendationer/pa-webbriktlinjer-finns-lagkrav-och-rekommendationer) · [PTS service rules, PTSFS 2024:6](https://pts.se/regelbibliotek/foreskrifter-om-vissa-tjansters-tillganglighet/) · [PTS e-commerce requirements](https://www.pts.se/digital-inkludering/lagkrav/introduktion-till-tillganglighetsdirektivet/branschspecifika-krav/)
- [ ] **Before live.** Record who provides each service, document any exemption relied on, test
  the full journey with assistive technology and publish accessible compliance and support
  information where required. Assign ongoing testing and a process for fixing and reporting
  nonconformity. [PTS service accessibility information](https://www.pts.se/digital-inkludering/lagen-om-vissa-produkters-och-tjansters-tillganglighet/information-om-tjanstens-tillganglighet/)

## Security and NIS2

- **Scope.** The Swedish Cybersäkerhetslag implementing NIS2 entered into force on 15 January
  2026. The working assumption is that a small booking software operator and ordinary salons are
  outside direct scope (verify with a lawyer). Check entity size including group links,
  jurisdiction, actual services and sector. Reassess as hosting evolves, including cloud or
  managed services, marketplace or domain registration offerings, and for healthcare customers
  that may be covered. Size-independent scope rules exist. In-scope customers may require
  supplier controls even if Cresavo is outside direct scope. If in scope, register, implement
  management oversight and risk controls, and support significant-incident reporting (normally
  24-hour early warning, 72-hour notification and a final report within one month of the
  notification, subject to applicable rules). [Swedish Cybersecurity Act (2025:1506)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/cybersakerhetslag-20251506_sfs-2025-1506/) · [NIS2, Articles 2, 20–23 and annexes](https://eur-lex.europa.eu/eli/dir/2022/2555/oj) · [Swedish Civil Defence Authority registration guidance](https://www.mcf.se/sv/aktuellt/nyheter/2026/februari/anmala-sin-verksamhet-enligt-cybersakerhetslagen-nis2/)
- **Baseline.** Apply risk-appropriate GDPR Article 32 safeguards and the [Cresavo pilot gate](../QUALITY_SECURITY.md#pilot-gate-before-the-first-real-customer). Prove tenant
  isolation across app, API, gateway, exports, jobs and backups. Require role-based access, MFA
  for privileged users and time-limited support access. Encrypt data in transit and at rest,
  handle secrets centrally, patch dependencies, monitor access, protect rate-limited actions,
  test restores and maintain vulnerability and incident response. For own domains, verify
  ownership, enforce HTTPS and test domain detachment and tenant configuration. [GDPR, Articles 25 and 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- **Related scope check.** Assess the Cyber Resilience Act for EU commercial software
  distribution, covered remote data processing and any open-source steward role (verify with a
  lawyer). Its main obligations generally apply from 11 December 2027, with Article 14 reporting
  already applicable from 11 September 2026 where in scope. [Cyber Resilience Act, Articles 2–3, 14, 24 and 71](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng)
- [ ] **Before live.** Complete the security and privacy review, run a cross-tenant access test
  and a backup restore, exercise incident escalation and record the NIS2 and CRA scope
  decisions.

## EU AI Act and agent booking

- **Roles and timing.** Cresavo may be the provider of an AI system it puts into service under
  its own name using a third-party model. The salon generally deploys it for its business. An
  independent booking agent has its own operator and role. Classify each integration and
  intended purpose, including any future clinical decision support, triage or uses affecting
  access to essential services (verify with a lawyer). Ordinary scheduling is expected to fall
  outside high-risk categories (verify with a lawyer). Providers and deployers take appropriate
  AI literacy measures under Article 4. [Current AI Act, Articles 3–6 and annexes](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng)
- **Transparency.** Article 50 has applied since 2 August 2026. For direct customer interaction,
  present a clear, accessible AI notice by first interaction unless AI involvement is obvious
  under the legal test. Apply it across chat, voice or embedded assistants where relevant.
  Assess Article 50(2) machine-readable marking separately where the system generates synthetic
  text, audio, image or video, and assess the deployer disclosure rules for deepfakes or
  public-interest text if introduced. The limited marking transition for qualifying pre-existing
  systems does not defer chatbot disclosure. Provide a route to a human or ordinary booking. [European Commission Article 50 guidance](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems)
  · [Commission transparency FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- **Bookings by an agent.** An agent may interact with the consumer on another service. Map who
  gives the notice and who processes data at each step. A gateway receiving an API call from an
  agent is not by itself a direct interaction with a person. Record delegated authority and
  scope, distinguish an availability lookup from a binding booking, and require verifiable
  authorisation for commitments, including charges. Expose the seller, total price, terms and
  cancellation or withdrawal choices to the consumer through the flow. Return durable
  confirmation and provide a way to correct or cancel. Review legal authority and acceptance
  evidence for delegated contracts (verify with a lawyer). See [Distance Contracts Act](https://data.riksdagen.se/dokument/sfs-2005-59.html) and the [gateway contract](../GATEWAY_SPLIT.md).
- **Logging and data minimisation.** Log version or provider, action, scoped actor, approval,
  timestamp and result with a defined retention period, minimal personal data and access
  controls. Keep prompts and health data out of routine logs. Cresavo should use these records
  to trace and correct scheduling actions. The Act separately requires automatic event logging
  for high-risk systems and generally at least six months' retention for logs under the
  provider's or deployer's control, subject to applicable law. Screen for GDPR Article 22 if a
  future flow makes solely automated decisions with legal or similarly significant effects. [AI Act, Articles 12, 19 and 26](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng)
  · [GDPR, Articles 5 and 22](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- [ ] **Before live AI or agent booking.** Record classification and provider roles, train
  operators, approve model processing and transfers, and test first-contact notice, human
  fallback, consent and terms evidence, and rejected unauthorised or duplicate bookings. Require
  these checks across both Cresavo and any external gateway integration.

## SMS sender identity in Sweden

- **Current rules and rollout.** Swedish anti-fraud rules took effect on 1 August 2026. The
  electronic communications ordinance authorises PTS to keep a voluntary register of SMS sender
  names, with application and annual fees under the ordinance. PTS described implementation work
  targeting early 2027. A voluntary public register and the carrier or aggregator registration
  required for particular routes are distinct. The industry already offers sender-name
  protection through participating aggregators. Confirm the public register's launch status,
  current PTS rules, fees, carrier filtering and provider requirements at activation (verify
  with a lawyer). [PTS anti-fraud announcement](https://www.pts.se/nyheter-och-pressmeddelanden/nya-regler-ska-stoppa-sms--och-telefonbedragerier/) · [PTS on the voluntary register](https://www.pts.se/internet-och-telefoni/sakerhet-och-skydd-av-uppgifter/telefonbedragerier/) · [Electronic Communications Ordinance, register provisions](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-2022511-om-elektronisk-kommunikation_sfs-2022-511/) · [PTS report on industry sender protection](https://pts.se/contentassets/5e528ad87da44392b60bd9bcff673df7/att-motverka-tillvagagangssatt-dar-elektroniska-kommunikationstjanster-anvands-for-att-genomfora-bedragerier.pdf)
- **Product responsibility.** Verify a salon's authority to use the sender name. Store
  registration and approval status per sender, route and provider. Use approved, recognisable
  senders and handle rejection visibly. When an alphanumeric sender cannot receive replies,
  provide a working opt-out mechanism for campaigns. Keep sender configuration and fallback
  subject to local provider rules and consent controls.
- [ ] **Before live SMS.** Obtain written provider confirmation of Swedish A2P routes and
  approved sender IDs. Test delivery, sender display, rejection handling and campaign opt-out on
  supported networks.

## Open-source licensing and trademark

- **AGPL-3.0-only.** Cresavo and downstream operators that modify the covered program must
  prominently offer all users who interact with the modified version over a network access to
  its Corresponding Source at no charge via a standard network download. Provide the source of
  the exact running version, including applicable build and installation scripts. Distribution
  of source or binaries and images has additional notice and source obligations under §§ 4–6.
  Preserve copyright and licence notices, retain third-party notices, and review the licensing
  of dependencies and boundaries for connected proprietary code (verify with a lawyer). [GNU AGPL v3, §§ 1, 4–6 and 13](https://www.gnu.org/licenses/agpl-3.0.en.html) ·
  [Repository licence](../../LICENSE) · [Third-party notices](../../THIRD_PARTY_NOTICES.md)
- **Trademark.** The project treats use of the Cresavo name and logo separately from the
  software licence. Preserve required attribution, use truthful descriptions of project origin
  and use a distinct identity for independent modified offerings under the project's draft
  policy. Confirm rights, clearance, any registration and the policy's terms before relying on
  exclusivity or enforcing it (verify with a lawyer). [Swedish Trademark Act](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/varumarkeslag-20101877_sfs-2010-1877/) · [PRV trademark guidance](https://www.prv.se/sv/Varumarke/Vad-ar-ett-varumarke/) · [Cresavo draft trademark policy](../../TRADEMARK.md)
- [ ] **Before live.** Test the source offer from each hosted interface where users interact
  with a modified release and verify the download matches the release and can build. Audit the
  distributed artefacts, notices and excluded brand assets. Review the trademark policy before
  making it final.

## Feature tags

Use the relevant rows when specifying, reviewing or enabling a feature. GDPR and security apply
wherever personal data is processed. Apply AGPL and trademark checks when shipping, hosting or
branding a release.

| Feature | Regimes to check |
| --- | --- |
| Bookings | GDPR, e-commerce and distance contracts, prices and terms, accessibility, security, health data where the booking reveals health status |
| Reminders | GDPR, electronic marketing if promotional, SMS sender identity, accessibility of linked flows, health confidentiality |
| Campaigns | GDPR, Marketing Act, SMS sender identity, cookie consent for tracking, consumer price disclosures |
| Journal | GDPR Articles 6 and 9, patient data and aesthetic rules if applicable, clinical confidentiality, security |
| Gift cards | Consumer terms and distance contracts, VAT/vouchers and bookkeeping, payments and cash registers, accessibility |
| Payments | PSD2/SCA, consumer price/refund rules, cash registers and receipts, bookkeeping/VAT, GDPR, accessibility, security |
| Deposits/no-show fees | Distance withdrawal and fair terms, payment authorisation/SCA, refunds and disputes, cash registers, VAT and bookkeeping |
| Reviews | Marketing Act and Omnibus rules, GDPR, health confidentiality, accessibility |
| AI assistant | AI Act, GDPR and transfers, security, health exclusions, marketing and consumer rules for customer-facing content, accessibility |
| Agent booking | AI Act, GDPR and transfers, security and delegation, e-commerce and consumer contracts, payments/SCA if enabled, accessibility |
| Data export | GDPR access, portability and processor exit, security, patient records, accounting archive and SIE |
| Own domain | E-commerce identity, GDPR notices, LEK cookie consent, accessibility, TLS and tenant security, AGPL and trademark |
| Analytics | LEK terminal access and consent, GDPR legal basis and transfers, security, health data exclusion |

## How we keep this current

Assign a release owner to review this backlog quarterly, before the first real pilot and
whenever a feature, provider, data location, payment flow, business category or country changes.
For each enabled item, record the accountable party, source and date, implementation issue, test
evidence and specialist decisions in the release checklist. Recheck open questions against the
law and regulator guidance in force at release, especially the PTS SMS rollout, AI guidance and
PSD2 successors. Adapt contracts, consumer duties, tax, messages and accessibility for each new
market before enabling it. [Council text on the successor Payment Services Regulation](https://data.consilium.europa.eu/doc/document/ST-8543-2026-REV-1/en/pdf)

## Ten pre-launch checks

1. Sign the DPA, confirm roles and subprocessors, approve transfers and publish privacy notices.
2. Test data rights, retention, backup deletion, offboarding and breach response, and complete DPIA screening.
3. Verify tenant isolation, secure authentication and access, restore and monitoring before the first pilot.
4. Keep health data out of the core pilot and approve clinical records and aesthetic workflows separately.
5. Show the seller, total price and fair terms, and test confirmation, withdrawal, fees and refunds.
6. Audit cookies and test the complete customer journey against the accessibility baseline.
7. If enabling payments, confirm direct PSP settlement, SCA, receipt handling and settlement reconciliation.
8. Approve VAT, gift card treatment and accounting exports before enabling the related finance features.
9. Verify SMS senders, marketing permission and opt-out, review provenance, and AI disclosure and agent authority for enabled features.
10. Verify the hosted Corresponding Source offer, distributed notices and trademark policy.
