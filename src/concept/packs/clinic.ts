import { salonWith, servicesFor, stockOf, teamWith, takes } from "./base";
import type { JournalText, Pack } from "./types";

// Physiotherapy clinic: assessment and rehab with Anna, recovery massage with Erik. Fictional.

const physio = servicesFor("anna", "physio");
const recovery = servicesFor("erik", "recovery");

const JOURNAL_PHYSIO: JournalText[] = [
  { treatment: "Initial assessment of the right knee: range of motion, strength and gait.", observations: "Pain on the inner side when bending past 100 degrees, mild swelling.", advice: "Relative rest for a week, exercises 2 x 10 daily. Follow-up in 2 weeks." },
  { treatment: "Manual therapy and exercise for the lower back.", observations: "Stiffness in L4-L5, better rotation after treatment.", advice: "Walk daily, avoid long sitting. Core exercises three times a week." },
  { treatment: "Rehab session: balance, hip strength and step-ups.", observations: "Clear progress, steadier on one leg.", advice: "Continue the programme and add a weight next week." },
];

const JOURNAL_RECOVERY: JournalText[] = [
  { treatment: "Sports massage of calves and hamstrings after a long run.", observations: "Tight calves, tender near the Achilles tendon.", advice: "Easy week, stretch calves after every run." },
  { treatment: "Deep tissue massage of neck and shoulders.", observations: "Trigger points in the upper trapezius, more on the right.", advice: "Heat before bed and shoulder mobility twice a day." },
  { treatment: "Recovery massage, light pressure on legs and back.", observations: "General tension, good relaxation.", advice: "Drink water and sleep well tonight." },
];

export const clinic: Pack = {
  id: "clinic",
  vocabulary: { customer: "patient", service: "treatment" },
  categories: ["physio", "recovery"],
  salon: salonWith("Physiotherapy and recovery in Vasastan"),
  staff: teamWith(
    { title: "Physiotherapist", bio: "Licensed physiotherapist since 2010, knees and backs. Opened Salong Eko in 2019." },
    { title: "Massage therapist", bio: "Sports and recovery massage. Has worked at Eko since 2022." },
  ),
  services: [
    physio("assessment", "Initial assessment", 60, 995, "Examination, diagnosis and a plan.", 26, takes("couch-paper", 0.025), takes("gloves", 0.02), takes("surface-spray", 0.02)),
    physio("follow-up", "Follow-up treatment", 45, 795, "Manual therapy and exercise.", 2, takes("couch-paper", 0.025), takes("gloves", 0.02), takes("tape", 0.05), takes("surface-spray", 0.02)),
    physio("rehab", "Rehab session", 45, 695, "Guided exercise for strength and balance.", 2, takes("couch-paper", 0.025), takes("surface-spray", 0.02)),
    physio("acupuncture", "Acupuncture", 30, 495, "Dry needling for tension and pain.", 3, takes("needles", 0.05), takes("couch-paper", 0.025), takes("gloves", 0.02)),
    recovery("sports-massage", "Sports massage 60 min", 60, 895, "Firm massage for training and recovery.", 4, takes("massage-oil", 0.06), takes("couch-paper", 0.025)),
    recovery("deep-massage", "Deep tissue massage 45 min", 45, 695, "Targeted work on tight areas.", 4, takes("massage-oil", 0.05), takes("couch-paper", 0.025)),
    recovery("recovery-massage", "Recovery massage 30 min", 30, 495, "Light massage after a hard week.", 3, takes("massage-oil", 0.03), takes("couch-paper", 0.025)),
  ],
  stock: [
    stockOf("couch-paper", "Couch paper roll", "Hygiene", "roll", 10, 4, 1.8, "Medicinab", 79),
    stockOf("gloves", "Nitrile gloves M", "Hygiene", "pack of 100", 6, 3, 1, "Medicinab", 95),
    stockOf("surface-spray", "Surface disinfectant", "Hygiene", "1 l bottle", 4, 2, 0.6, "Medicinab", 99),
    stockOf("needles", "Acupuncture needles", "Treatment", "box of 100", 3, 2, 0.4, "Medicinab", 149),
    stockOf("tape", "Kinesiology tape", "Treatment", "roll", 2, 4, 1.5, "Rehabgrossen", 69),
    stockOf("massage-oil", "Massage oil, unscented", "Massage", "1 l bottle", 1, 3, 1.2, "Rehabgrossen", 245),
    stockOf("foam-roller", "Foam roller (retail)", "Retail", "each", 6, 2, 0.5, "Rehabgrossen", 189, 399),
    stockOf("heat-pack", "Reusable heat pack (retail)", "Retail", "each", 9, 3, 0.7, "Rehabgrossen", 79, 179),
  ],
  suppliers: [
    { name: "Medicinab", email: "kundservice@medicinab.example", leadDays: 2 },
    { name: "Rehabgrossen", email: "order@rehabgrossen.example", leadDays: 4 },
  ],
  modules: ["journal", "stock", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages"],
  journalTemplates: [
    { id: "clinic-assessment", category: "physio" },
    { id: "clinic-followup", category: "physio" },
    { id: "clinic-recovery", category: "recovery" },
  ],
  popular: [
    { assessment: 1.5, "follow-up": 6, rehab: 3, acupuncture: 1 },
    { "sports-massage": 5, "deep-massage": 3, "recovery-massage": 2 },
  ],
  customerNotes: [
    ["Knee injury, referred by a doctor.", "Chronic lower back pain, avoid heavy lifting.", "On blood thinners, take extra care with needles.", "Recovering from a shoulder operation."],
    ["Runner, wants focus on calves.", "Sensitive to strong pressure.", "Tension headaches, focus on the neck.", "Usually books straight after work."],
  ],
  tagRules: [
    { find: "blood thinners", tag: "Blood thinners" },
    { find: "Knee injury", tag: "Referral" },
    { find: "Runner", tag: "Runner" },
  ],
  journal: [JOURNAL_PHYSIO, JOURNAL_RECOVERY],
  journalFor: {},
  reviews: [
    {
      5: ["Anna found the cause of my knee pain and I am running again.", "Thorough, calm and clear explanations.", "My back has never felt better."],
      4: ["Very good treatment, hard to find parking.", "Skilled physio, would like more evening slots."],
      3: ["Good treatment but I waited 15 minutes."],
      2: ["It felt rushed for the first appointment."],
    },
    {
      5: ["Erik found the right spots in my calves. Great before the race.", "Calm room and perfect pressure.", "Best sports massage in Vasastan."],
      4: ["Good massage, the room was a little cold.", "Nice pressure, would have liked more time."],
      3: ["Good, but the pressure was too light for me."],
      2: ["Hoped for more focus on my neck."],
    },
  ],
  freshReviews: {
    happy: "A calm clinic. Anna explained my knee clearly and gave me a plan I can follow. Warmly recommended!",
    meh: "Lovely massage, but I waited almost 15 minutes before we got started.",
  },
  featured: ["rehab", "follow-up", "sports-massage", "recovery-massage"],
  requests: {
    returning: { serviceId: "follow-up", body: "Hi! Do you have a follow-up treatment on Thursday afternoon? It is that time again." },
    newClient: {
      name: "Tove Sjölund",
      body: "Hi, my knee has been sore for a week after running. Could I come in soon? Tove, 070-188 21 07",
      reply: "Hi Tove! I would like to see that knee. I have an assessment slot for you, see below. /Anna",
      serviceId: "assessment",
    },
  },
  giftIdea: "a massage",
  campaigns: [
    {
      id: "c-autumn",
      name: "Autumn recovery massage −15%",
      serviceIds: ["sports-massage", "deep-massage"],
      discountPercent: 15,
      startsInDays: -78,
      endsInDays: -36,
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      link: "salongeko.example/c/autumn-recovery-4f8",
      stats: { reach: 2310, clicks: 174, bookings: 19, revenue: 19 * 760 },
    },
    {
      id: "c-bundle",
      name: "Assessment + rehab programme",
      serviceIds: ["assessment", "rehab"],
      discountPercent: 10,
      startsInDays: -9,
      endsInDays: 19,
      status: "active",
      channels: ["instagram", "facebook"],
      link: "salongeko.example/c/assessment-rehab-2k9",
      stats: { reach: 1190, clicks: 82, bookings: 5, revenue: 5 * 1520 },
    },
  ],
  looseNote: {
    supplier: "Medicinab",
    deliveries: [
      { stockId: "gloves", quantity: 2 },
      { stockId: "couch-paper", quantity: 6 },
      { stockId: "surface-spray", quantity: 2 },
    ],
  },
};
