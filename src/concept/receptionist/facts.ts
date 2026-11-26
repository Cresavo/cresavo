import { salonFacts, spokenView } from "./tools";
import type { SalonView } from "./host";
import type { Locale } from "@/lib/locale";

// The salon's facts as one short note for the start of a call: today's date,
// opening hours for the week, treatments with their ids and prices, and the
// staff. They come from the call's own salon (the same view the tools use), so
// edits in the studio show up, and the receptionist knows them from the first
// word instead of looking them up (and announcing the lookup) mid-call.

export function salonFactsNote(view: SalonView, language?: Locale): string {
  const facts = salonFacts(spokenView(view, language));
  const currency = facts.treatments[0]?.currency ?? "SEK";
  return [
    "The salon right now (current; use these directly, without get_salon_info):",
    `- Now: ${facts.now.day} (${facts.now.date}), ${facts.now.time}.`,
    `- Opening hours: ${facts.openingHours.map((day) => `${day.day} (${day.date}): ${day.open}`).join("; ")}. For a later date, find_free_times says whether the salon is open.`,
    `- Treatments (id: name, minutes, price in ${currency}, staff ids): ${facts.treatments.map((t) => `${t.id}: ${t.name}, ${t.minutes} min, ${t.price}, ${t.staffIds.join("/")}`).join("; ")}.`,
    `- Staff: ${facts.staff.map((member) => `${member.id} = ${member.name}${"owner" in member && member.owner ? " (owner)" : ""}`).join(", ")}.`,
    `- Bookings can be made up to ${facts.bookableDaysAhead} days ahead.`,
  ].join("\n");
}
