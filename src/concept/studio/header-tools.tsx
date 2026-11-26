"use client";

import { useDemo } from "../store";
import { AssistantHeaderButton } from "./assistant/assistant-launcher";
import { HelpButton } from "./help/help-button";
import { NoticesButton } from "./notices/notices-button";
import { ThemeToggle } from "../ui/theme-toggle";

/**
 * The assistant, "New since last time", Help and the theme switch on a desktop: always the last things in a page's title row, on the content's
 * right edge, so they never float above the page. Phones and tablets have them in the top bar instead.
 */
export function HeaderTools() {
  const state = useDemo();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {state?.modules.assistant && <AssistantHeaderButton />}
      {state && <NoticesButton />}
      <HelpButton compact />
      <ThemeToggle />
    </div>
  );
}
