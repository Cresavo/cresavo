import type { Salon, Service, Staff, StockItem, Supplier } from "./types";

// Fixed, fictional facts about the demo salon. No real people.

export const SALON: Salon = {
  name: "Salong Eko",
  slug: "salong-eko",
  tagline: "Foot care and massage in Vasastan",
  address: "Dalagatan 34",
  area: "113 24 Stockholm · Vasastan",
  phone: "070-174 06 50",
  email: "hej@salongeko.example",
  orgNumber: "559900-0000",
  hours: {
    0: null,
    1: { open: 9 * 60, close: 18 * 60 },
    2: { open: 9 * 60, close: 18 * 60 },
    3: { open: 9 * 60, close: 18 * 60 },
    4: { open: 9 * 60, close: 19 * 60 },
    5: { open: 9 * 60, close: 17 * 60 },
    6: { open: 10 * 60, close: 15 * 60 },
  },
  lunch: { start: 12 * 60, end: 13 * 60 },
};

export const STAFF: Staff[] = [
  {
    id: "anna",
    firstName: "Anna",
    lastName: "Ekström",
    role: "Owner",
    title: "Medical foot therapist",
    workdays: [1, 2, 3, 4, 5],
    bio: "Qualified medical foot therapist since 2012. Opened Salong Eko in 2019.",
    phone: "070-174 06 51",
  },
  {
    id: "erik",
    firstName: "Erik",
    lastName: "Holm",
    role: "Employee",
    title: "Massage therapist",
    workdays: [1, 2, 4, 5, 6],
    bio: "Classic and sports massage. Has worked at Eko since 2022.",
    phone: "070-174 06 52",
  },
];

export const SERVICES: Service[] = [
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

export const STOCK: StockItem[] = [
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

export const SUPPLIERS: Supplier[] = [
  { name: "Podoshop", email: "orders@podoshop.example", leadDays: 3 },
  { name: "Spagrossisten", email: "order@spagrossisten.example", leadDays: 5 },
  { name: "Medicinab", email: "kundservice@medicinab.example", leadDays: 2 },
];

export const FIRST_NAMES_F = [
  "Agneta", "Annika", "Astrid", "Birgitta", "Britt", "Camilla", "Cecilia", "Eva", "Elin", "Ellen",
  "Emma", "Frida", "Gunilla", "Hanna", "Helena", "Ida", "Inger", "Johanna", "Karin", "Katarina",
  "Kerstin", "Lena", "Linnea", "Lisa", "Maja", "Malin", "Margareta", "Maria", "Marie", "Monica",
  "Nora", "Pia", "Sara", "Sofia", "Susanne", "Ulla", "Ylva", "Åsa", "Märta", "Signe",
];

export const FIRST_NAMES_M = [
  "Anders", "Bengt", "Björn", "Daniel", "David", "Fredrik", "Gustav", "Göran", "Hans", "Henrik",
  "Jan", "Johan", "Jonas", "Karl", "Lars", "Leif", "Magnus", "Martin", "Mats", "Mikael",
  "Nils", "Olof", "Oskar", "Per", "Peter", "Stefan", "Sven", "Thomas", "Ulf", "Viktor",
];

export const LAST_NAMES = [
  "Andersson", "Berg", "Bergström", "Blom", "Dahl", "Ek", "Engström", "Eriksson", "Forsberg", "Gustafsson",
  "Hansson", "Hedlund", "Holmberg", "Isaksson", "Jakobsson", "Johansson", "Karlsson", "Larsson", "Lind", "Lindberg",
  "Lindgren", "Ljung", "Lundgren", "Lundqvist", "Magnusson", "Malm", "Nilsson", "Norén", "Nyberg", "Olsson",
  "Persson", "Rask", "Sandberg", "Sjöberg", "Strand", "Sundin", "Svensson", "Wallin", "Wikström", "Åberg",
];

export const CUSTOMER_NOTES_FOOT = [
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

export const CUSTOMER_NOTES_MASSAGE = [
  "Tight neck and shoulders from office work.",
  "Runner – wants focus on calves and thighs.",
  "Sensitive to eucalyptus, use unscented oil.",
  "Prefers firm pressure.",
  "Occasional lower back pain, avoid deep pressure there.",
  "Pregnant, week 24 – side-lying position.",
  "Usually books straight after work.",
  "Tension headaches, focus on the neck.",
];
