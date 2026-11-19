import { salonWith, servicesFor, stockOf, teamWith, takes } from "./base";
import type { JournalText, Pack } from "./types";

// Hair salon: cuts with Anna, colour with Erik. Fictional.

const cut = servicesFor("anna", "cut");
const colour = servicesFor("erik", "colour");

const JOURNAL_CUT: JournalText[] = [
  { treatment: "Cut and blow-dry, about 3 cm off the length.", observations: "Healthy ends, a little dry at the tips.", advice: "Leave-in conditioner twice a week. Trim again in 8 weeks." },
  { treatment: "Restyled the fringe and shaped the sides.", observations: "Strong cowlick at the crown, cut it slightly longer.", advice: "Blow-dry the fringe with a round brush while it is damp." },
  { treatment: "Short cut with clippers on the sides, scissors on top.", observations: "Thick hair, grows fast at the neckline.", advice: "Tidy the neckline every 4 weeks." },
];

const JOURNAL_COLOUR: JournalText[] = [
  { treatment: "Root colour 6.3 with 6% developer, 35 minutes.", observations: "Even grey coverage, scalp calm.", advice: "Colour-safe shampoo. Roots again in 6 weeks." },
  { treatment: "Half-head highlights and a gloss toner.", observations: "Lifted to a pale gold, hair kept its strength.", advice: "Purple shampoo once a week. Toner again in 8 weeks." },
  { treatment: "Full colour from dark brown to chestnut.", observations: "Good result, a little sensitivity at the hairline.", advice: "Avoid hot water for two days. Use the mask once a week." },
];

const services = [
  cut("womens-cut", "Women's cut and blow-dry", 60, 795, "Consultation, wash, cut and blow-dry.", 8, takes("shampoo", 0.02), takes("conditioner", 0.02), takes("towels", 0.02)),
  cut("mens-cut", "Men's cut", 30, 450, "Clipper and scissor cut with a tidy neckline.", 5, takes("shampoo", 0.01), takes("towels", 0.01)),
  cut("kids-cut", "Children's cut", 30, 350, "A calm cut for children under 12.", 8, takes("towels", 0.01)),
  cut("blow-dry", "Blow-dry and styling", 30, 395, "Wash and style for an event or just because.", 4, takes("shampoo", 0.01), takes("styling-spray", 0.02)),
  colour("root-colour", "Root colour", 90, 1095, "Colour on the regrowth with a gloss.", 6, takes("colour-tube", 0.5), takes("developer", 0.1), takes("gloves", 0.02), takes("foils", 0.01)),
  colour("full-colour", "Full colour", 120, 1495, "All-over colour from roots to ends.", 8, takes("colour-tube", 1), takes("developer", 0.2), takes("gloves", 0.02)),
  colour("highlights", "Highlights", 150, 1895, "Foil highlights with toner and treatment.", 10, takes("foils", 0.04), takes("bleach", 0.1), takes("developer", 0.1), takes("gloves", 0.02)),
];

export const hair: Pack = {
  id: "hair",
  vocabulary: { customer: "client", service: "service", sv: { customer: "kund", service: "tjänst" } },
  categories: ["cut", "colour"],
  salon: salonWith("Hair and colour in Vasastan"),
  staff: teamWith(
    { title: "Hairdresser", bio: "Hairdresser since 2011, specialised in precision cuts. Opened Salong Eko in 2019." },
    { title: "Colourist", bio: "Colour and highlights. Has worked at Eko since 2022." },
  ),
  services,
  stock: [
    stockOf("shampoo", "Backbar shampoo", "Hair care", "1 l bottle", 5, 2, 0.8, "Hårgrossisten", 119),
    stockOf("conditioner", "Backbar conditioner", "Hair care", "1 l bottle", 4, 2, 0.6, "Hårgrossisten", 129),
    stockOf("styling-spray", "Styling spray", "Hair care", "300 ml can", 1, 3, 1.2, "Hårgrossisten", 79),
    stockOf("colour-tube", "Colour tubes, assorted", "Colour", "60 ml tube", 22, 12, 9, "Colorama", 62),
    stockOf("developer", "Developer 6%", "Colour", "1 l bottle", 3, 2, 0.8, "Colorama", 85),
    stockOf("bleach", "Lightening powder", "Colour", "500 g tub", 4, 2, 0.4, "Colorama", 215),
    stockOf("foils", "Foils", "Colour", "box of 100", 7, 3, 0.9, "Colorama", 95),
    stockOf("gloves", "Nitrile gloves M", "Hygiene", "pack of 100", 6, 3, 1, "Hårgrossisten", 89),
    stockOf("towels", "Salon towels", "Hygiene", "pack of 12", 8, 3, 1.1, "Hårgrossisten", 249),
    stockOf("retail-shampoo", "Take-home shampoo (retail)", "Retail", "250 ml bottle", 10, 4, 1.2, "Hårgrossisten", 98, 229),
    stockOf("retail-wax", "Styling wax (retail)", "Retail", "75 ml tin", 8, 3, 0.8, "Hårgrossisten", 75, 179),
  ],
  suppliers: [
    { name: "Hårgrossisten", email: "orders@hargrossisten.example", leadDays: 3 },
    { name: "Colorama", email: "order@colorama.example", leadDays: 4 },
  ],
  modules: ["journal", "stock", "campaigns", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages"],
  journalTemplates: [
    { id: "hair-cut", category: "cut" },
    { id: "hair-colour", category: "colour" },
  ],
  popular: [
    { "womens-cut": 6, "mens-cut": 3, "kids-cut": 1, "blow-dry": 1.4 },
    { "root-colour": 5, "full-colour": 2.5, highlights: 2 },
  ],
  customerNotes: [
    ["Wants to grow out the fringe.", "Prefers a quiet chair and no small talk.", "Sensitive scalp, use the mild shampoo.", "Brings a photo of the cut they want.", "Always books before holidays."],
    ["Allergic to some dyes, patch test every time.", "Covering grey, wants a natural result.", "Wants to stay blond without brassy tones.", "Likes bold colours, changes every season."],
  ],
  tagRules: [
    { find: "Allergic", tag: "Allergy" },
    { find: "Sensitive scalp", tag: "Sensitive scalp" },
  ],
  journal: [JOURNAL_CUT, JOURNAL_COLOUR],
  journalFor: {},
  reviews: [
    {
      5: ["Anna listened and gave me exactly the cut I wanted.", "Best haircut I have had in years, and a calm salon.", "Quick, precise and so friendly. Booked the next one already."],
      4: ["Lovely cut, I just wish there were more evening times.", "Great result, a little pricey but worth it."],
      3: ["Good cut but I waited 15 minutes."],
      2: ["It felt rushed and the sides were uneven."],
    },
    {
      5: ["Erik got my colour exactly right, the grey is gone.", "The highlights look natural and my hair still feels strong.", "Finally a colourist who explains everything."],
      4: ["Beautiful colour, the appointment ran a bit long.", "Very happy, would like a longer toner step."],
      3: ["Nice colour but a bit warmer than we discussed."],
      2: ["Hoped for a lighter result."],
    },
  ],
  freshReviews: {
    happy: "Such a calm salon. Anna took her time and gave me the cut I had in my head. Warmly recommended!",
    meh: "Lovely colour, but I waited almost 15 minutes before we got started.",
  },
  featured: ["highlights", "womens-cut", "full-colour", "mens-cut"],
  requests: {
    returning: { serviceId: "womens-cut", body: "Hi! Do you have a cut on Thursday afternoon? It is that time again." },
    newClient: {
      name: "Tove Sjölund",
      body: "Hi, I would like a new colour and a cut before a wedding in two weeks. Could I come in soon? Tove, 070-188 21 07",
      reply: "Hi Tove! Congratulations on the wedding. I have a slot for a consultation and root colour, see below. /Anna",
      serviceId: "root-colour",
    },
  },
  giftIdea: "a haircut",
  campaigns: [
    {
      id: "c-autumn",
      name: "Autumn colour −15%",
      serviceIds: ["root-colour", "full-colour"],
      discountPercent: 15,
      startsInDays: -78,
      endsInDays: -36,
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      link: "salongeko.example/c/autumn-colour-4f8",
      stats: { reach: 3120, clicks: 241, bookings: 26, revenue: 26 * 1180 },
    },
    {
      id: "c-bundle",
      name: "Cut + blow-dry bundle",
      serviceIds: ["womens-cut", "blow-dry"],
      discountPercent: 10,
      startsInDays: -9,
      endsInDays: 19,
      status: "active",
      channels: ["instagram", "facebook"],
      link: "salongeko.example/c/cut-bundle-2k9",
      stats: { reach: 1480, clicks: 104, bookings: 9, revenue: 9 * 1070 },
    },
  ],
  looseNote: {
    supplier: "Hårgrossisten",
    deliveries: [
      { stockId: "gloves", quantity: 2 },
      { stockId: "towels", quantity: 2 },
      { stockId: "shampoo", quantity: 2 },
    ],
  },
};
