import type { Service, StockItem, Supplier } from "../data/types";
import { salonWith, teamWith } from "./base";
import type { JournalText, Pack, ReviewTexts } from "./types";

// Foot care and massage: the original demo business. Fictional, no real people.

const SALON = salonWith("Foot care and massage in Vasastan");

const STAFF = teamWith(
  { title: "Medical foot therapist", bio: "Qualified medical foot therapist since 2012. Opened Salong Eko in 2019." },
  { title: "Massage therapist", bio: "Classic and sports massage. Has worked at Eko since 2022." },
);

const SERVICES: Service[] = [
  {
    id: "medical-foot-care",
    name: "Medical foot care",
    category: "foot",
    staffIds: ["anna"],
    duration: 60,
    price: 795,
    description: "Nail trimming and filing, removal of calluses and corns, foot bath and foot cream.",
    recallWeeks: 6,
  },
  {
    id: "basic-foot-care",
    name: "Basic foot care",
    category: "foot",
    staffIds: ["anna"],
    duration: 45,
    price: 650,
    description: "Nail care and a softening treatment for healthy feet.",
    recallWeeks: 6,
    consumption: [{ stockId: "urea-cream", quantity: 0.2 }, { stockId: "foot-files", quantity: 0.02 }, { stockId: "cuticle-oil", quantity: 0.03 }, { stockId: "foot-bath-salt", quantity: 0.03 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "spa-foot-care",
    name: "Spa foot care",
    category: "foot",
    staffIds: ["anna"],
    duration: 75,
    price: 950,
    description: "Medical foot care with scrub, mask and a longer foot massage.",
    recallWeeks: 8,
    consumption: [{ stockId: "urea-cream", quantity: 0.3 }, { stockId: "foot-files", quantity: 0.02 }, { stockId: "cuticle-oil", quantity: 0.03 }, { stockId: "foot-bath-salt", quantity: 0.05 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "ingrown-nail",
    name: "Ingrown nail treatment",
    category: "foot",
    staffIds: ["anna"],
    duration: 30,
    price: 450,
    description: "Treatment of ingrown nails and follow-up of nail braces.",
    recallWeeks: 4,
    consumption: [{ stockId: "urea-cream", quantity: 0.1 }, { stockId: "scalpel-blades", quantity: 0.01 }, { stockId: "felt-padding", quantity: 0.1 }, { stockId: "corn-plasters", quantity: 0.1 }, { stockId: "skin-disinfectant", quantity: 0.02 }, { stockId: "gloves", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "classic-60",
    name: "Classic massage 60 min",
    category: "massage",
    staffIds: ["erik"],
    duration: 60,
    price: 795,
    description: "Full-body massage for back, neck, shoulders and legs.",
    recallWeeks: 4,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.06 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "classic-30",
    name: "Classic massage 30 min",
    category: "massage",
    staffIds: ["erik"],
    duration: 30,
    price: 495,
    description: "Focus on back, neck and shoulders.",
    recallWeeks: 3,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.03 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "deep-tissue",
    name: "Deep tissue massage",
    category: "massage",
    staffIds: ["erik"],
    duration: 60,
    price: 895,
    description: "Firmer pressure for tight muscles and stiffness.",
    recallWeeks: 4,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.07 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "relax-90",
    name: "Relaxing massage 90 min",
    category: "massage",
    staffIds: ["erik"],
    duration: 90,
    price: 1195,
    description: "Slow full-body massage with warm oil.",
    recallWeeks: 8,
    consumption: [{ stockId: "massage-oil-eucalyptus", quantity: 0.1 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
  {
    id: "foot-calf-massage",
    name: "Foot and calf massage",
    category: "massage",
    staffIds: ["erik"],
    duration: 30,
    price: 450,
    description: "Relaxing massage of feet and calves.",
    recallWeeks: 6,
    consumption: [{ stockId: "massage-oil-neutral", quantity: 0.02 }, { stockId: "couch-roll", quantity: 0.025 }],
  },
];

const STOCK: StockItem[] = [
  { id: "urea-cream", name: "Foot cream urea 10%", category: "Foot care", unit: "75 ml tube", inStock: 3, reorderAt: 8, usagePerWeek: 5, supplier: "Podoshop", unitCost: 89, onOrder: 0 },
  { id: "massage-oil-neutral", name: "Massage oil, unscented", category: "Massage", unit: "1 l bottle", inStock: 1, reorderAt: 3, usagePerWeek: 1.5, supplier: "Spagrossisten", unitCost: 245, onOrder: 0 },
  { id: "cuticle-oil", name: "Cuticle oil", category: "Foot care", unit: "15 ml bottle", inStock: 14, reorderAt: 5, usagePerWeek: 1, supplier: "Podoshop", unitCost: 59, onOrder: 0 },
  { id: "foot-files", name: "Disposable foot files", category: "Foot care", unit: "pack of 50", inStock: 6, reorderAt: 2, usagePerWeek: 0.6, supplier: "Podoshop", unitCost: 210, onOrder: 0 },
  { id: "scalpel-blades", name: "Scalpel blades no. 15", category: "Foot care", unit: "pack of 100", inStock: 4, reorderAt: 1, usagePerWeek: 0.3, supplier: "Medicinab", unitCost: 320, onOrder: 0 },
  { id: "felt-padding", name: "Pressure relief felt", category: "Foot care", unit: "sheet", inStock: 22, reorderAt: 8, usagePerWeek: 2, supplier: "Podoshop", unitCost: 35, onOrder: 0 },
  { id: "corn-plasters", name: "Corn plasters", category: "Foot care", unit: "pack of 10", inStock: 9, reorderAt: 4, usagePerWeek: 1, supplier: "Medicinab", unitCost: 48, onOrder: 0 },
  { id: "foot-bath-salt", name: "Foot bath salt", category: "Foot care", unit: "1 kg jar", inStock: 5, reorderAt: 2, usagePerWeek: 0.5, supplier: "Spagrossisten", unitCost: 129, onOrder: 0 },
  { id: "massage-oil-eucalyptus", name: "Massage oil, eucalyptus", category: "Massage", unit: "500 ml bottle", inStock: 6, reorderAt: 2, usagePerWeek: 0.7, supplier: "Spagrossisten", unitCost: 189, onOrder: 0 },
  { id: "couch-roll", name: "Couch paper roll", category: "Hygiene", unit: "roll", inStock: 11, reorderAt: 4, usagePerWeek: 1.5, supplier: "Medicinab", unitCost: 79, onOrder: 0 },
  { id: "gloves", name: "Nitrile gloves M", category: "Hygiene", unit: "pack of 100", inStock: 7, reorderAt: 3, usagePerWeek: 1, supplier: "Medicinab", unitCost: 95, onOrder: 0 },
  { id: "skin-disinfectant", name: "Skin disinfectant", category: "Hygiene", unit: "500 ml bottle", inStock: 5, reorderAt: 2, usagePerWeek: 0.6, supplier: "Medicinab", unitCost: 119, onOrder: 0 },
  { id: "surface-disinfectant", name: "Surface disinfectant", category: "Hygiene", unit: "1 l bottle", inStock: 4, reorderAt: 2, usagePerWeek: 0.5, supplier: "Medicinab", unitCost: 99, onOrder: 0 },
  { id: "glass-file", name: "Glass nail file (retail)", category: "Retail", unit: "each", inStock: 12, reorderAt: 4, usagePerWeek: 1, supplier: "Podoshop", unitCost: 65, onOrder: 0, salePrice: 149 },
  { id: "home-foot-cream", name: "Home care foot cream (retail)", category: "Retail", unit: "100 ml tube", inStock: 9, reorderAt: 4, usagePerWeek: 1.2, supplier: "Podoshop", unitCost: 95, onOrder: 0, salePrice: 219 },
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
      "Anna is so thorough and calm. My feet feel brand new!",
      "Best foot care I have ever had. Clean, warm and professional.",
      "Finally someone who takes my diabetic feet seriously. Thank you!",
      "Cosy salon and Anna explains everything she does. Will be back.",
      "The corn is gone after two visits. Fantastic.",
    ],
    4: [
      "Very good treatment, just a bit hard to find parking.",
      "Skilled foot therapist. Would love more evening slots.",
      "Lovely and thorough, a little pricey but worth it.",
    ],
    3: ["Good treatment but I waited 15 minutes for my appointment.", "Fine, but it felt a bit rushed this time."],
    2: ["Long wait and it felt rushed."],
  },
  massage: {
    5: [
      "Erik found exactly the right spots in my shoulders. Walked out a new person.",
      "Calm room, warm oil and perfect pressure.",
      "Best massage in Vasastan. Already booked the next one.",
      "My calves thank you for the deep tissue massage before the race!",
    ],
    4: [
      "Really nice massage. The room was a little cold at first.",
      "Good pressure and friendly welcome. Would have liked a bit more time.",
    ],
    3: ["Good massage but the pressure was too light for me.", "Okay, but the music was too loud."],
    2: ["Had hoped for more focus on my neck as I asked."],
  },
};

export const footMassage: Pack = {
  id: "foot-massage",
  vocabulary: { customer: "customer", service: "treatment" },
  categories: ["foot", "massage"],
  salon: SALON,
  palette: "forest",
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
    happy: "Such a calm place. Anna took her time and explained why I get calluses. Warmly recommended!",
    meh: "Lovely massage, but I waited almost 15 minutes before we got started.",
  },
  featured: ["spa-foot-care", "medical-foot-care", "relax-90", "classic-60"],
  requests: {
    returning: { serviceId: "medical-foot-care", body: "Hi! Do you have a foot care slot on Thursday afternoon? It is that time again." },
    newClient: {
      name: "Tove Sjölund",
      body: "Hi, my big toenail has been sore for a week. Could I come in soon? Tove, 070-188 21 07",
      reply: "Hi Tove! That sounds like an ingrown nail – I can help with that. I have a slot for you, see below. /Anna",
      serviceId: "ingrown-nail",
    },
  },
  giftIdea: "a massage",
  campaigns: [
    {
      id: "c-autumn",
      name: "Autumn massage −15%",
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
      name: "Foot care + calf massage bundle",
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
