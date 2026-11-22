import { translate, type MessageKey } from "../i18n";
import type { Service, StockItem, Supplier } from "../data/types";
import { salonWith, teamWith } from "./base";
import type { JournalText, Pack, ReviewTexts } from "./types";

type FixtureSuffix<Key> = Key extends `fixture.eko.${infer Suffix}` ? Suffix : never;
const copy = (key: FixtureSuffix<MessageKey>) =>
  translate("en", `fixture.eko.${key}`);

// Foot care and massage: the original demo business. Fictional, no real people.

const SALON = salonWith(copy("tagline"));

const STAFF = teamWith(
  { title: copy("staff.anna.title"), bio: copy("staff.anna.bio") },
  { title: copy("staff.erik.title"), bio: copy("staff.erik.bio") },
);

const SERVICES: Service[] = [
  {
    id: "medical-foot-care",
    name: copy("service.medical.name"),
    category: "foot",
    staffIds: ["anna"],
    duration: 60,
    price: 795,
    description: copy("service.medical.description"),
    recallWeeks: 6,
  },
  {
    id: "basic-foot-care",
    name: copy("service.basic.name"),
    category: "foot",
    staffIds: ["anna"],
    duration: 45,
    price: 650,
    description: copy("service.basic.description"),
    recallWeeks: 6,
    consumption: [{ stockId: "urea-cream", quantity: 0.2 }, { stockId: "foot-files", quantity: 0.02 }, { stockId: "cuticle-oil", quantity: 0.03 }, { stockId: "foot-bath-salt", quantity: 0.03 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "spa-foot-care",
    name: copy("service.spa.name"),
    category: "foot",
    staffIds: ["anna"],
    duration: 75,
    price: 950,
    description: copy("service.spa.description"),
    recallWeeks: 8,
    consumption: [{ stockId: "urea-cream", quantity: 0.3 }, { stockId: "foot-files", quantity: 0.02 }, { stockId: "cuticle-oil", quantity: 0.03 }, { stockId: "foot-bath-salt", quantity: 0.05 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "ingrown-nail",
    name: copy("service.ingrown.name"),
    category: "foot",
    staffIds: ["anna"],
    duration: 30,
    price: 450,
    description: copy("service.ingrown.description"),
    recallWeeks: 4,
    consumption: [{ stockId: "urea-cream", quantity: 0.1 }, { stockId: "scalpel-blades", quantity: 0.01 }, { stockId: "felt-padding", quantity: 0.1 }, { stockId: "corn-plasters", quantity: 0.1 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "classic-60",
    name: copy("service.classic60.name"),
    category: "massage",
    staffIds: ["erik"],
    duration: 60,
    price: 795,
    description: copy("service.classic60.description"),
    recallWeeks: 4,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.06 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "classic-30",
    name: copy("service.classic30.name"),
    category: "massage",
    staffIds: ["erik"],
    duration: 30,
    price: 495,
    description: copy("service.classic30.description"),
    recallWeeks: 3,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.03 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "deep-tissue",
    name: copy("service.deep.name"),
    category: "massage",
    staffIds: ["erik"],
    duration: 60,
    price: 895,
    description: copy("service.deep.description"),
    recallWeeks: 4,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.07 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "relax-90",
    name: copy("service.relax.name"),
    category: "massage",
    staffIds: ["erik"],
    duration: 90,
    price: 1195,
    description: copy("service.relax.description"),
    recallWeeks: 8,
    consumption: [{ stockId: "massage-oil-eucalyptus", quantity: 0.1 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "foot-calf-massage",
    name: copy("service.footCalf.name"),
    category: "massage",
    staffIds: ["erik"],
    duration: 30,
    price: 450,
    description: copy("service.footCalf.description"),
    recallWeeks: 6,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
];

const STOCK: StockItem[] = [
  { id: "urea-cream", name: copy("stock.urea-cream"), category: copy("stockCategory.foot"), unit: copy("stockUnit.tube75"), inStock: 3, reorderAt: 8, usagePerWeek: 5, supplier: "Podoshop", unitCost: 89, onOrder: 0 },
  { id: "massage-oil-neutral", name: copy("stock.massage-oil-neutral"), category: copy("stockCategory.massage"), unit: copy("stockUnit.bottle1l"), inStock: 1, reorderAt: 3, usagePerWeek: 1.5, supplier: "Spagrossisten", unitCost: 245, onOrder: 0 },
  { id: "cuticle-oil", name: copy("stock.cuticle-oil"), category: copy("stockCategory.foot"), unit: copy("stockUnit.bottle15"), inStock: 14, reorderAt: 5, usagePerWeek: 1, supplier: "Podoshop", unitCost: 59, onOrder: 0 },
  { id: "foot-files", name: copy("stock.foot-files"), category: copy("stockCategory.foot"), unit: copy("stockUnit.pack50"), inStock: 6, reorderAt: 2, usagePerWeek: 0.6, supplier: "Podoshop", unitCost: 210, onOrder: 0 },
  { id: "scalpel-blades", name: copy("stock.scalpel-blades"), category: copy("stockCategory.foot"), unit: copy("stockUnit.pack100"), inStock: 4, reorderAt: 1, usagePerWeek: 0.3, supplier: "Medicinab", unitCost: 320, onOrder: 0 },
  { id: "felt-padding", name: copy("stock.felt-padding"), category: copy("stockCategory.foot"), unit: copy("stockUnit.sheet"), inStock: 22, reorderAt: 8, usagePerWeek: 2, supplier: "Podoshop", unitCost: 35, onOrder: 0 },
  { id: "corn-plasters", name: copy("stock.corn-plasters"), category: copy("stockCategory.foot"), unit: copy("stockUnit.pack10"), inStock: 9, reorderAt: 4, usagePerWeek: 1, supplier: "Medicinab", unitCost: 48, onOrder: 0 },
  { id: "foot-bath-salt", name: copy("stock.foot-bath-salt"), category: copy("stockCategory.foot"), unit: copy("stockUnit.jar1kg"), inStock: 5, reorderAt: 2, usagePerWeek: 0.5, supplier: "Spagrossisten", unitCost: 129, onOrder: 0 },
  { id: "massage-oil-eucalyptus", name: copy("stock.massage-oil-eucalyptus"), category: copy("stockCategory.massage"), unit: copy("stockUnit.bottle500"), inStock: 6, reorderAt: 2, usagePerWeek: 0.7, supplier: "Spagrossisten", unitCost: 189, onOrder: 0 },
  { id: "couch-roll", name: copy("stock.couch-roll"), category: copy("stockCategory.hygiene"), unit: copy("stockUnit.roll"), inStock: 11, reorderAt: 4, usagePerWeek: 1.5, supplier: "Medicinab", unitCost: 79, onOrder: 0 },
  { id: "gloves", name: copy("stock.gloves"), category: copy("stockCategory.hygiene"), unit: copy("stockUnit.pack100"), inStock: 7, reorderAt: 3, usagePerWeek: 1, supplier: "Medicinab", unitCost: 95, onOrder: 0 },
  { id: "skin-disinfectant", name: copy("stock.skin-disinfectant"), category: copy("stockCategory.hygiene"), unit: copy("stockUnit.bottle500"), inStock: 5, reorderAt: 2, usagePerWeek: 0.6, supplier: "Medicinab", unitCost: 119, onOrder: 0 },
  { id: "surface-disinfectant", name: copy("stock.surface-disinfectant"), category: copy("stockCategory.hygiene"), unit: copy("stockUnit.bottle1l"), inStock: 4, reorderAt: 2, usagePerWeek: 0.5, supplier: "Medicinab", unitCost: 99, onOrder: 0 },
  { id: "glass-file", name: copy("stock.glass-file"), category: copy("stockCategory.retail"), unit: copy("stockUnit.each"), inStock: 12, reorderAt: 4, usagePerWeek: 1, supplier: "Podoshop", unitCost: 65, onOrder: 0, salePrice: 149 },
  { id: "home-foot-cream", name: copy("stock.home-foot-cream"), category: copy("stockCategory.retail"), unit: copy("stockUnit.tube100"), inStock: 9, reorderAt: 4, usagePerWeek: 1.2, supplier: "Podoshop", unitCost: 95, onOrder: 0, salePrice: 219 },
];

const SUPPLIERS: Supplier[] = [
  { name: "Podoshop", email: "orders@podoshop.example", leadDays: 3 },
  { name: "Spagrossisten", email: "order@spagrossisten.example", leadDays: 5 },
  { name: "Medicinab", email: "kundservice@medicinab.example", leadDays: 2 },
];

const CUSTOMER_NOTES_FOOT = [
  "Type 2 diabetes – check sensation and circulation every visit.",
  "Thin skin on the heels, go gently with the file.",
  "Recurring ingrown nail, right big toe.",
  "Prefers morning appointments.",
  "On blood thinners – take extra care.",
  "Corn on left foot, felt padding works well.",
  "Likes calm music and a little chat.",
  "Finds stairs difficult – book when the lift is working.",
  "Calluses under the sole, recommended urea cream.",
  "Always arrives ten minutes early.",
];

const CUSTOMER_NOTES_MASSAGE = [
  "Tight neck and shoulders from office work.",
  "Runner – wants focus on calves and thighs.",
  "Sensitive to eucalyptus, use unscented oil.",
  "Prefers firm pressure.",
  "Occasional lower back pain, avoid deep pressure there.",
  "Pregnant, week 24 – side-lying position.",
  "Usually books straight after work.",
  "Tension headaches, focus on the neck.",
];

const JOURNAL_FOOT: JournalText[] = [
  {
    treatment: "Medical foot care. Trimmed and filed nails, removed calluses on heels and balls of the feet.",
    observations: "Dry skin on the heels, small cracks on the right heel. Nails fine.",
    advice: "Urea cream 10% morning and evening. Avoid walking barefoot on cold floors.",
  },
  {
    treatment: "Treated corn on left foot (5th toe), applied felt padding.",
    observations: "Corn smaller than last visit. Pressure from a narrow shoe.",
    advice: "Switch to shoes with a wider toe box. Change the felt every third day.",
  },
  {
    treatment: "Ingrown nail, right big toe. Cleaned the nail fold and placed a packing.",
    observations: "Slight redness, no infection. The nail grows at an angle.",
    advice: "Salt foot bath twice a week. Cut straight across, not round the corners.",
  },
  {
    treatment: "Medical foot care with an extra sensation check (monofilament).",
    observations: "Normal sensation in both feet. Good circulation. Thickened nail, left big toe.",
    advice: "Keep checking the feet daily. Return visit in 6 weeks.",
  },
  {
    treatment: "Spa foot care: scrub, mask, foot care and 15 min foot massage.",
    observations: "Healthy feet, light calluses under the ball of the foot.",
    advice: "Foot cream at home twice a week is enough.",
  },
];

const JOURNAL_MASSAGE: JournalText[] = [
  {
    treatment: "Classic massage of back, neck and shoulders. Medium pressure.",
    observations: "Very tight upper trapezius, more on the right side.",
    advice: "Neck mobility exercises twice a day. Raise the screen at work.",
  },
  {
    treatment: "Deep tissue massage of calves and thighs after running.",
    observations: "Tight calf muscles, tender around the Achilles tendon.",
    advice: "Stretch the calves after every run. Increase distance gradually.",
  },
  {
    treatment: "Relaxing full-body massage with warm oil.",
    observations: "Tension in the lower back that eased during the treatment.",
    advice: "Daily walks, heat on the lower back when needed.",
  },
];

const REVIEW_TEXT: { foot: ReviewTexts; massage: ReviewTexts } = {
  foot: {
    5: [
      copy("review.foot.5.1"),
      copy("review.foot.5.2"),
      copy("review.foot.5.3"),
      copy("review.foot.5.4"),
      copy("review.foot.5.5"),
    ],
    4: [
      copy("review.foot.4.1"),
      copy("review.foot.4.2"),
      copy("review.foot.4.3"),
    ],
    3: [copy("review.foot.3.1"), copy("review.foot.3.2")],
    2: [copy("review.foot.2.1")],
  },
  massage: {
    5: [
      copy("review.massage.5.1"),
      copy("review.massage.5.2"),
      copy("review.massage.5.3"),
      copy("review.massage.5.4"),
    ],
    4: [
      copy("review.massage.4.1"),
      copy("review.massage.4.2"),
    ],
    3: [copy("review.massage.3.1"), copy("review.massage.3.2")],
    2: [copy("review.massage.2.1")],
  },
};

export const footMassage: Pack = {
  id: "foot-massage",
  vocabulary: { customer: "customer", service: "treatment" },
  categories: ["foot", "massage"],
  salon: SALON,
  palette: "forest",
  about: copy("about"),
  staff: STAFF,
  services: SERVICES,
  stock: STOCK,
  suppliers: SUPPLIERS,
  modules: ["journal", "stock", "campaigns", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages"],
  journalTemplates: [
    { id: "foot", category: "foot" },
    { id: "ingrown", category: "foot" },
    { id: "massage", category: "massage" },
    { id: "deep", category: "massage" },
  ],
  popular: [
    { "medical-foot-care": 6, "basic-foot-care": 3, "spa-foot-care": 1.4, "ingrown-nail": 0.8 },
    { "classic-60": 5, "classic-30": 2, "deep-tissue": 3, "relax-90": 1.3, "foot-calf-massage": 1 },
  ],
  customerNotes: [CUSTOMER_NOTES_FOOT, CUSTOMER_NOTES_MASSAGE],
  tagRules: [
    { find: "diabetes", tag: "Diabetes" },
    { find: "Thin skin", tag: "Sensitive skin" },
    { find: "Runner", tag: "Runner" },
  ],
  journal: [JOURNAL_FOOT, JOURNAL_MASSAGE],
  journalFor: { "spa-foot-care": JOURNAL_FOOT[4], "ingrown-nail": JOURNAL_FOOT[2] },
  reviews: [REVIEW_TEXT.foot, REVIEW_TEXT.massage],
  freshReviews: {
    happy: copy("review.happy"),
    meh: copy("review.meh"),
  },
  featured: ["spa-foot-care", "medical-foot-care", "relax-90", "classic-60"],
  requests: {
    returning: { serviceId: "medical-foot-care", body: copy("inbox.returning") },
    newClient: {
      name: "Tove Sjölund",
      body: copy("inbox.new"),
      reply: copy("inbox.newReply"),
      serviceId: "ingrown-nail",
    },
  },
  giftIdea: "a massage",
  campaigns: [
    {
      id: "c-autumn",
      name: copy("campaign.autumn"),
      serviceIds: ["classic-60", "deep-tissue"],
      discountPercent: 15,
      startsInDays: -78,
      endsInDays: -36,
      status: "ended",
      channels: ["instagram", "newsletter", "sms"],
      link: "salongeko.example/c/autumn-massage-4f8",
      stats: { reach: 2840, clicks: 212, bookings: 23, revenue: 23 * 782 },
    },
    {
      id: "c-bundle",
      name: copy("campaign.bundle"),
      serviceIds: ["medical-foot-care", "foot-calf-massage"],
      discountPercent: 10,
      startsInDays: -9,
      endsInDays: 19,
      status: "active",
      channels: ["instagram", "facebook"],
      link: "salongeko.example/c/foot-bundle-2k9",
      stats: { reach: 1310, clicks: 96, bookings: 7, revenue: 7 * 840 },
    },
  ],
  looseNote: {
    supplier: "Medicinab",
    deliveries: [
      { stockId: "gloves", quantity: 2 },
      { stockId: "couch-roll", quantity: 6 },
      { stockId: "skin-disinfectant", quantity: 2 },
    ],
  },
};
