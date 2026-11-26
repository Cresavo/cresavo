import { createDemoState } from "../../data/generate";
import { salonClock } from "../../tools/clock";
import { salonFacts } from "../tools";

// The demo salon's facts, written into the web call's instructions on the
// server: today's date, opening hours for the week, treatments with their ids
// and prices, and the staff. Maja then knows them from the first word instead
// of looking them up (and announcing the lookup) in the middle of the call.
// They come from the same demo data and the same function get_salon_info uses.

let cached: { today: string; state: ReturnType<typeof createDemoState> } | undefined;

export function demoSalonFacts(now: Date = new Date()): string {
  const clock = salonClock(now);
  // The demo data for a day is the same all day; built once per day, not per call.
  if (cached?.today !== clock.today) cached = { today: clock.today, state: createDemoState(clock.today) };
  const facts = salonFacts({ state: cached.state, clock, instant: now.getTime() });
  const currency = facts.treatments[0]?.currency ?? "SEK";
  return [
    "# The salon right now (current; use these directly, without get_salon_info)",
    `- Now: ${facts.now.day} (${facts.now.date}), ${facts.now.time}.`,
    `- Opening hours: ${facts.openingHours.map((day) => `${day.day}: ${day.open}`).join("; ")}.`,
    `- Treatments (id: name, minutes, price in ${currency}, staff ids): ${facts.treatments.map((t) => `${t.id}: ${t.name}, ${t.minutes} min, ${t.price}, ${t.staffIds.join("/")}`).join("; ")}.`,
    `- Staff: ${facts.staff.map((member) => `${member.id} = ${member.name}${"owner" in member && member.owner ? " (owner)" : ""}`).join(", ")}.`,
    `- Bookings can be made up to ${facts.bookableDaysAhead} days ahead.`,
  ].join("\n");
}
