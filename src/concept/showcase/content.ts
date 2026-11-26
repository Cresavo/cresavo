import { translate, type MessageKey } from "../i18n";
import { SALON, TEAM } from "./salon";

// What both showcase sites say about the salon. The showcase is a Swedish
// salon's own website, so its copy is Swedish and lives here rather than in
// the product's dictionaries. The about text, titles and bios are the demo
// salon's own Swedish fixture text, so the sites and the booking agree.

const fixture = (key: string) => translate("sv", `fixture.eko.${key}` as MessageKey);

/** The salon's own words about itself, one entry per paragraph. */
export const ABOUT = fixture("about").split("\n\n");

export const PEOPLE = TEAM.map((person) => ({
  id: person.id,
  name: `${person.firstName} ${person.lastName}`,
  title: fixture(`staff.${person.id}.title`),
  bio: fixture(`staff.${person.id}.bio`),
  photo: person.photo,
}));

/** Who does which kind of treatment, by category. */
export const CATEGORY_PERSON: Record<string, string | undefined> = { foot: "Anna", massage: "Erik" };

const [city, area] = SALON.area.split(" · ");
export const ADDRESS = { street: SALON.address, city, area };

export const MAP_URL = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${SALON.address}, Stockholm`)}`;

/** The cancellation rule the demo salon's booking applies (24 hours, no late fee), as the owner would put it. */
export const CANCEL_NOTE = "Du kan ändra eller avboka online fram till ett dygn före besöket.";
