import { z } from "zod";
import { readTool } from "../tools/define";
import { helpSteps } from "./map/entries";
import { findHelp } from "./map/lookup";
import type { HelpEntry } from "./map/types";

// "Show me" described as an assistant tool, in the tools' own vocabulary: a step that only opens a page or a view
// is a `read`, the button at the end that changes data is a `propose` (the owner presses it). Not registered with
// the protocol adapters yet; a connected assistant could call it once the studio relays it to the pointer.

function place(entry: HelpEntry) {
  return {
    id: entry.id,
    route: entry.route,
    steps: helpSteps(entry.id).map((step) => ({ id: step.id, kind: step.safety === "navigate" ? "read" : "propose" })),
  };
}

export const showMeTool = readTool({
  name: "show_me",
  title: "Show the owner where something is in the studio",
  description: "Finds the place in the studio for a question in Swedish or English and returns the steps to point at. The studio points them out on screen and never presses a button that changes data.",
  input: z.object({ question: z.string().min(1).max(300) }),
  run: (_context, { question }) => {
    const match = findHelp(question);
    return { place: match.best && place(match.best), alternatives: match.alternatives.map(place), ambiguous: match.ambiguous };
  },
});
