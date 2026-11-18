import { salonWith, servicesFor, stockOf, teamWith, takes } from "./base";
import type { JournalText, Pack } from "./types";

// Personal training studio: one-to-one with Anna, small groups with Erik. Fictional.

const personal = servicesFor("anna", "personal");
const group = servicesFor("erik", "group");

const JOURNAL_PERSONAL: JournalText[] = [
  { treatment: "Strength session: squats, rows and presses, 4 x 8.", observations: "Good depth in the squat, left shoulder a little tight.", advice: "Mobility work for the shoulder daily. Add 2.5 kg next week." },
  { treatment: "Technique session on deadlift and hip hinge.", observations: "Lower back rounds at the bottom, fixed with cues.", advice: "Practise the hinge with a broomstick at home." },
  { treatment: "Programme review and test of squat, push-ups and plank.", observations: "Plank time up from 60 to 95 seconds.", advice: "New 6-week block, three sessions a week." },
];

const JOURNAL_GROUP: JournalText[] = [
  { treatment: "Small-group circuit: kettlebells, rowing and core.", observations: "Everyone kept the pace, good form on swings.", advice: "Drink water, walk for 20 minutes on the rest day." },
  { treatment: "Mobility class: hips, thoracic spine and ankles.", observations: "Tight hips in most of the group.", advice: "Ten minutes of hip openers before bed." },
  { treatment: "Running clinic: cadence, posture and a short interval set.", observations: "Slightly long stride, heel striking.", advice: "Shorten the stride and add one easy run a week." },
];

export const trainer: Pack = {
  id: "trainer",
  vocabulary: { customer: "client", service: "session" },
  categories: ["personal", "group"],
  salon: salonWith("Personal training in Vasastan"),
  staff: teamWith(
    { title: "Personal trainer", bio: "Personal trainer since 2013, strength and rehab. Opened Salong Eko in 2019." },
    { title: "Group trainer", bio: "Small-group, mobility and running. Has worked at Eko since 2022." },
  ),
  services: [
    personal("pt-60", "Personal training 60 min", 60, 795, "One-to-one session built around your goals.", 2, takes("wipes", 0.04), takes("towels", 0.02)),
    personal("pt-intro", "Intro session", 45, 295, "Meet, test and plan. A first session for new clients.", 8, takes("wipes", 0.03)),
    personal("pt-review", "Programme review", 30, 395, "Check progress and update the programme.", 6, takes("wipes", 0.02)),
    personal("pt-technique", "Technique session", 45, 595, "Slow, focused work on the main lifts.", 3, takes("wipes", 0.03), takes("bands", 0.01)),
    group("small-group", "Small-group session", 60, 295, "Up to five people, one trainer. Price per person.", 2, takes("wipes", 0.05), takes("towels", 0.03)),
    group("mobility", "Mobility class", 45, 250, "Gentle class for hips, back and shoulders.", 2, takes("wipes", 0.04), takes("bands", 0.01)),
    group("running-clinic", "Running clinic", 60, 350, "Technique and intervals outdoors or on the track.", 2, takes("wipes", 0.02)),
  ],
  stock: [
    stockOf("wipes", "Equipment wipes", "Studio", "tub of 200", 2, 3, 1.5, "Gymgrossisten", 69),
    stockOf("towels", "Studio towels", "Studio", "pack of 12", 6, 3, 0.9, "Gymgrossisten", 249),
    stockOf("bands", "Resistance bands", "Equipment", "each", 14, 6, 0.8, "Gymgrossisten", 89),
    stockOf("chalk", "Lifting chalk", "Equipment", "block", 8, 3, 0.3, "Gymgrossisten", 35),
    stockOf("first-aid", "First-aid supplies", "Studio", "kit", 3, 1, 0.1, "Gymgrossisten", 249),
    stockOf("bars", "Protein bars (retail)", "Retail", "box of 12", 5, 2, 0.8, "Näringsgrossen", 159, 299),
    stockOf("shaker", "Shaker bottle (retail)", "Retail", "each", 11, 4, 0.7, "Näringsgrossen", 45, 129),
  ],
  suppliers: [
    { name: "Gymgrossisten", email: "orders@gymgrossisten.example", leadDays: 3 },
    { name: "Näringsgrossen", email: "order@naringsgrossen.example", leadDays: 4 },
  ],
  modules: ["journal", "stock", "campaigns", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages"],
  journalTemplates: [
    { id: "trainer-session", category: "personal" },
    { id: "trainer-intake", category: "personal" },
  ],
  popular: [
    { "pt-60": 7, "pt-intro": 1, "pt-review": 1.5, "pt-technique": 1.6 },
    { "small-group": 6, mobility: 3, "running-clinic": 2 },
  ],
  customerNotes: [
    ["Training for a half marathon.", "Recovering from a shoulder injury, avoid overhead work.", "Wants to build strength after pregnancy.", "Prefers early mornings."],
    ["Joins the Tuesday group every week.", "New to exercise, wants a calm pace.", "Tight hips from desk work.", "Likes to train with a friend."],
  ],
  tagRules: [
    { find: "injury", tag: "Injury" },
    { find: "marathon", tag: "Runner" },
  ],
  journal: [JOURNAL_PERSONAL, JOURNAL_GROUP],
  journalFor: {},
  reviews: [
    {
      5: ["Anna built a plan that fits my week. I am stronger than ever.", "Clear, calm coaching. Worth every krona.", "I finally enjoy training. Thank you!"],
      4: ["Great sessions, I wish there were more early slots.", "Good coaching, a little pricey but it works."],
      3: ["Good session but we started a few minutes late."],
      2: ["Hoped for more attention on my technique."],
    },
    {
      5: ["Erik's mobility class fixed my stiff hips.", "The small group is friendly and well planned.", "The running clinic changed how I run."],
      4: ["Fun group, the studio was a bit warm.", "Good class, would like a longer warm-up."],
      3: ["Okay class, but the music was too loud."],
      2: ["The group felt too big for the space."],
    },
  ],
  freshReviews: {
    happy: "Such a calm studio. Anna took her time with my technique and I feel stronger already. Warmly recommended!",
    meh: "Great group session, but we waited almost 15 minutes before we got started.",
  },
  featured: ["pt-intro", "pt-60", "small-group", "mobility"],
  requests: {
    returning: { serviceId: "pt-60", body: "Hi! Do you have a personal training session on Thursday afternoon? It is that time again." },
    newClient: {
      name: "Tove Sjölund",
      body: "Hi, I want to start training for a 10k in spring. Could I book an intro session soon? Tove, 070-188 21 07",
      reply: "Hi Tove! A 10k is a great goal. I have an intro session for you, see below. /Anna",
      serviceId: "pt-intro",
    },
  },
  giftIdea: "a personal training session",
  campaigns: [
    {
      id: "c-autumn",
      name: "Autumn small groups −15%",
      serviceIds: ["small-group", "mobility"],
      discountPercent: 15,
      startsInDays: -78,
      endsInDays: -36,
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      link: "salongeko.example/c/autumn-group-4f8",
      stats: { reach: 2610, clicks: 198, bookings: 31, revenue: 31 * 250 },
    },
    {
      id: "c-bundle",
      name: "Intro + 5 sessions",
      serviceIds: ["pt-intro", "pt-60"],
      discountPercent: 10,
      startsInDays: -9,
      endsInDays: 19,
      status: "active",
      channels: ["instagram", "facebook"],
      link: "salongeko.example/c/intro-five-2k9",
      stats: { reach: 1250, clicks: 88, bookings: 6, revenue: 6 * 715 },
    },
  ],
  looseNote: {
    supplier: "Gymgrossisten",
    deliveries: [
      { stockId: "wipes", quantity: 4 },
      { stockId: "towels", quantity: 2 },
      { stockId: "chalk", quantity: 3 },
    ],
  },
};
