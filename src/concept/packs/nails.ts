import { salonWith, servicesFor, stockOf, teamWith, takes } from "./base";
import type { JournalText, Pack } from "./types";

// Nail studio: hands with Anna, feet with Erik. Fictional.

const manicure = servicesFor("anna", "manicure");
const pedicure = servicesFor("erik", "pedicure");

const JOURNAL_MANI: JournalText[] = [
  { treatment: "Classic manicure, shaped to a soft square, cuticle care.", observations: "Brittle nails, dry cuticles.", advice: "Cuticle oil every evening. Next visit in 3 weeks." },
  { treatment: "Gel polish, two coats of soft pink, no-wipe top coat.", observations: "Healthy nail plate, slight ridges.", advice: "Wear gloves when cleaning. Gel off in 3 weeks." },
  { treatment: "Gel removal and a repair of the right ring finger.", observations: "Nail thinned after earlier extensions.", advice: "Take a break from extensions for 4 weeks. Strengthening base coat." },
];

const JOURNAL_PEDI: JournalText[] = [
  { treatment: "Classic pedicure with foot bath, filing and polish.", observations: "Light calluses on the heels.", advice: "Foot cream daily. Next visit in 5 weeks." },
  { treatment: "Spa pedicure with scrub, mask and a short foot massage.", observations: "Dry skin, healthy nails.", advice: "Moisturise twice a day and avoid tight shoes." },
  { treatment: "Gel pedicure, soft coral.", observations: "Nails growing evenly.", advice: "Gel off in 4 weeks, sooner if it lifts." },
];

export const nails: Pack = {
  id: "nails",
  vocabulary: { customer: "client", service: "treatment" },
  categories: ["manicure", "pedicure"],
  salon: salonWith("Nails and pedicure in Vasastan"),
  staff: teamWith(
    { title: "Nail technician", bio: "Nail technician since 2015, gel and nail art. Opened Salong Eko in 2019." },
    { title: "Pedicurist", bio: "Pedicures and foot care. Has worked at Eko since 2022." },
  ),
  services: [
    manicure("classic-mani", "Classic manicure", 45, 450, "Shaping, cuticle care and polish.", 3, takes("cuticle-oil", 0.03), takes("buffers", 0.05), takes("table-paper", 0.02)),
    manicure("gel-polish", "Gel polish", 60, 650, "Manicure with long-lasting gel colour.", 3, takes("gel-polish", 0.05), takes("cuticle-oil", 0.03), takes("buffers", 0.05), takes("table-paper", 0.02)),
    manicure("gel-removal", "Gel removal and care", 30, 350, "Gentle soak-off and nourishing treatment.", 3, takes("remover", 0.05), takes("cuticle-oil", 0.02)),
    manicure("extensions", "Nail extensions", 90, 995, "Sculpted extensions with gel colour.", 4, takes("gel-polish", 0.08), takes("buffers", 0.1), takes("remover", 0.05), takes("table-paper", 0.02)),
    pedicure("classic-pedi", "Classic pedicure", 60, 650, "Foot bath, filing, cuticle care and polish.", 5, takes("foot-cream", 0.1), takes("buffers", 0.05), takes("table-paper", 0.02), takes("gloves", 0.02)),
    pedicure("spa-pedi", "Spa pedicure", 75, 850, "Pedicure with scrub, mask and foot massage.", 6, takes("foot-cream", 0.2), takes("buffers", 0.05), takes("table-paper", 0.02), takes("gloves", 0.02)),
    pedicure("gel-pedi", "Gel pedicure", 75, 900, "Pedicure finished with gel colour.", 5, takes("gel-polish", 0.05), takes("foot-cream", 0.1), takes("buffers", 0.05), takes("gloves", 0.02)),
  ],
  stock: [
    stockOf("gel-polish", "Gel polish, assorted", "Nail care", "15 ml bottle", 18, 10, 6, "Nagelgrossen", 89),
    stockOf("remover", "Acetone remover", "Nail care", "1 l bottle", 2, 3, 0.8, "Nagelgrossen", 79),
    stockOf("cuticle-oil", "Cuticle oil", "Nail care", "15 ml bottle", 9, 4, 1.2, "Nagelgrossen", 55),
    stockOf("buffers", "Nail buffers", "Tools", "pack of 100", 6, 2, 0.7, "Nagelgrossen", 120),
    stockOf("foot-cream", "Foot cream", "Foot care", "500 ml tub", 3, 2, 0.6, "Spagrossisten", 189),
    stockOf("table-paper", "Table paper", "Hygiene", "roll", 10, 4, 1.3, "Spagrossisten", 69),
    stockOf("gloves", "Nitrile gloves M", "Hygiene", "pack of 100", 7, 3, 0.9, "Spagrossisten", 89),
    stockOf("retail-oil", "Cuticle oil to take home (retail)", "Retail", "10 ml bottle", 12, 4, 1, "Nagelgrossen", 48, 129),
    stockOf("retail-hand-cream", "Hand cream (retail)", "Retail", "75 ml tube", 9, 4, 0.9, "Nagelgrossen", 62, 169),
  ],
  suppliers: [
    { name: "Nagelgrossen", email: "orders@nagelgrossen.example", leadDays: 3 },
    { name: "Spagrossisten", email: "order@spagrossisten.example", leadDays: 5 },
  ],
  modules: ["journal", "stock", "campaigns", "reviews", "waitlist", "assistant"],
  journalTemplates: [
    { id: "nails-mani", category: "manicure" },
    { id: "nails-pedi", category: "pedicure" },
  ],
  popular: [
    { "classic-mani": 3, "gel-polish": 6, "gel-removal": 1.5, extensions: 1.8 },
    { "classic-pedi": 4, "spa-pedi": 2, "gel-pedi": 2.5 },
  ],
  customerNotes: [
    ["Prefers short, natural nails.", "Allergic to some gel products, patch test first.", "Brings nail art ideas from Instagram.", "Bites nails, wants to grow them out."],
    ["Runs often, thick toenails.", "Wants sandal-ready feet before holidays.", "Sensitive to strong scents.", "Prefers soft colours on the feet."],
  ],
  tagRules: [
    { find: "Allergic", tag: "Allergy" },
    { find: "Runs often", tag: "Runner" },
  ],
  journal: [JOURNAL_MANI, JOURNAL_PEDI],
  journalFor: {},
  reviews: [
    {
      5: ["My gel nails lasted four weeks, perfect!", "Anna is so precise and the studio is calm.", "Best manicure I have had. Booked the next one right away."],
      4: ["Beautiful result, a little tricky to find parking.", "Great nails, would like more evening slots."],
      3: ["Nice colour but I waited 15 minutes."],
      2: ["The polish chipped after a week."],
    },
    {
      5: ["Erik made my feet look and feel new.", "Lovely spa pedicure, so relaxing.", "Gel pedicure held all summer."],
      4: ["Really nice pedicure, the room was a little cold.", "Good result, would have liked a longer foot massage."],
      3: ["Fine, but it felt a bit rushed."],
      2: ["I hoped for more focus on my heels."],
    },
  ],
  freshReviews: {
    happy: "Such a calm studio. Anna took her time and the gel looks perfect. Warmly recommended!",
    meh: "Lovely pedicure, but I waited almost 15 minutes before we got started.",
  },
  featured: ["spa-pedi", "gel-polish", "extensions", "classic-pedi"],
  requests: {
    returning: { serviceId: "gel-polish", body: "Hi! Do you have a gel polish time on Thursday afternoon? It is that time again." },
    newClient: {
      name: "Tove Sjölund",
      body: "Hi, I have a party on Saturday and would love extensions before. Could I come in soon? Tove, 070-188 21 07",
      reply: "Hi Tove! I can do extensions before Saturday. I have a slot for you, see below. /Anna",
      serviceId: "extensions",
    },
  },
  giftIdea: "a pedicure",
  campaigns: [
    {
      id: "c-autumn",
      name: "Autumn gel polish −15%",
      serviceIds: ["gel-polish", "gel-pedi"],
      discountPercent: 15,
      startsInDays: -78,
      endsInDays: -36,
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      link: "salongeko.example/c/autumn-gel-4f8",
      stats: { reach: 3380, clicks: 266, bookings: 29, revenue: 29 * 560 },
    },
    {
      id: "c-bundle",
      name: "Manicure + pedicure bundle",
      serviceIds: ["classic-mani", "classic-pedi"],
      discountPercent: 10,
      startsInDays: -9,
      endsInDays: 19,
      status: "active",
      channels: ["instagram", "facebook"],
      link: "salongeko.example/c/mani-pedi-2k9",
      stats: { reach: 1390, clicks: 99, bookings: 8, revenue: 8 * 990 },
    },
  ],
  looseNote: {
    supplier: "Spagrossisten",
    deliveries: [
      { stockId: "gloves", quantity: 2 },
      { stockId: "table-paper", quantity: 6 },
      { stockId: "foot-cream", quantity: 1 },
    ],
  },
};
