"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { t } from "../../i18n";
import { MAX_PEOPLE, MAX_PERSON_NAME } from "../../onboarding/salon";
import { Button, IconButton } from "../../ui/button";
import { ChoiceCards, Field, TextInput } from "../../ui/controls";

type Mode = "solo" | "team";

/** Just the owner, or the owner and a few colleagues. Everyone gets a calendar and every treatment. */
export function SetupTeam({ people, change }: { people: string[]; change: (people: string[]) => void }) {
  const owner = people[0] ?? "";
  const colleagues = people.slice(1);
  const mode: Mode = colleagues.length ? "team" : "solo";
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const choice = useRef<HTMLDivElement>(null);
  // Where the cursor goes after the rows change: a colleague's field, or the choice once nobody is left.
  const focusNext = useRef<number | "choice" | null>(null);
  useEffect(() => {
    // Choosing a team keeps focus on the choice; adding or removing a row moves it to a sensible place.
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "choice") choice.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    else if (target !== null) inputs.current[target]?.focus();
  }, [colleagues.length]);
  const remove = (index: number) => {
    const rest = colleagues.filter((_, n) => n !== index);
    focusNext.current = rest.length ? Math.min(index, rest.length - 1) : "choice";
    change([owner, ...rest]);
  };
  const setColleague = (index: number, name: string) => change([owner, ...colleagues.map((other, i) => i === index ? name : other)]);
  return <div className="space-y-6">
    <div ref={choice}>
      <ChoiceCards<Mode> label={t("setup.team")} value={mode}
        options={[{ value: "solo", label: t("setup.solo") }, { value: "team", label: t("setup.withTeam") }]}
        onChange={next => change(next === "solo" ? [owner] : [owner, ""])} />
    </div>
    <Field width="short" label={t("setup.yourName")} hint={t("setup.yourNameHint")}>
      <TextInput autoComplete="name" maxLength={MAX_PERSON_NAME} value={owner} onChange={e => change([e.target.value, ...colleagues])} />
    </Field>
    {mode === "team" && <div className="space-y-3">
      {colleagues.map((name, i) => {
        const label = t("setup.colleague", { number: i + 1 });
        return <div key={i} className="flex items-end gap-1 md:max-w-field-short">
          <Field label={label}>
            <TextInput ref={element => { inputs.current[i] = element; }} autoComplete="off" maxLength={MAX_PERSON_NAME} value={name}
              onChange={e => setColleague(i, e.target.value)} />
          </Field>
          <IconButton label={t("setup.remove", { name: name.trim() || label })}
            onClick={() => remove(i)}><X size={18} /></IconButton>
        </div>;
      })}
      {people.length < MAX_PEOPLE && <Button variant="tertiary" className="-ml-2" icon={<Plus size={16} />}
        onClick={() => { focusNext.current = colleagues.length; change([...people, ""]); }}>{t("setup.addColleague")}</Button>}
    </div>}
  </div>;
}
