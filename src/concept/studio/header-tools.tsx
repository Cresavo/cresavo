"use client";

import { useDemo } from "../store";
import { AssistantHeaderButton } from "./assistant/assistant-launcher";
import { HelpButton } from "./help/help-button";

/**
 * The assistant and Help on a desktop: always the last things in a page's title row, on the content's
 * right edge, so they never float above the page. Phones and tablets have them in the top bar instead.
 */
export function HeaderTools() {
  const state = useDemo();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {state?.modules.assistant && <AssistantHeaderButton />}
      <HelpButton compact />
    </div>
  );
}
