import type { Locale } from "@/lib/locale";
import type { DemoState, Service, Staff } from "../data/types";
import { getPack } from "../packs";
import { translate, type MessageKey } from ".";

const eko = getPack("foot-massage");
type ServiceLabel = Extract<MessageKey, `fixture.eko.service.${string}.name`> extends `fixture.eko.service.${infer Id}.name` ? `fixture.eko.service.${Id}` : never;
const serviceKeys: Partial<Record<string, ServiceLabel>> = {
  "medical-foot-care": "fixture.eko.service.medical",
  "basic-foot-care": "fixture.eko.service.basic",
  "spa-foot-care": "fixture.eko.service.spa",
  "ingrown-nail": "fixture.eko.service.ingrown",
  "classic-60": "fixture.eko.service.classic60",
  "classic-30": "fixture.eko.service.classic30",
  "deep-tissue": "fixture.eko.service.deep",
  "relax-90": "fixture.eko.service.relax",
  "foot-calf-massage": "fixture.eko.service.footCalf",
};

export function serviceCopy(service: Service, language: Locale): Service {
  const key = serviceKeys[service.id];
  const original = key && eko.services.find(({ id }) => id === service.id);
  if (!original || !key) return service;
  // Translate untouched fixture fields and preserve the owner's own copy.
  const nameKey = `${key}.name` as const;
  const descriptionKey = `${key}.description` as const;
  const name = service.name === original.name || service.name === translate("sv", nameKey)
    ? translate(language, nameKey) : service.name;
  const description = service.description === original.description || service.description === translate("sv", descriptionKey)
    ? translate(language, descriptionKey) : service.description;
  return name === service.name && description === service.description ? service : { ...service, name, description };
}

function staffCopy(person: Staff, language: Locale): Staff {
  const original = eko.staff.find(({ id }) => id === person.id);
  if (!original) return person;
  return {
    ...person,
    title: person.title === original.title ? translate(language, `fixture.eko.staff.${person.id}.title`) : person.title,
    bio: person.bio === original.bio ? translate(language, `fixture.eko.staff.${person.id}.bio`) : person.bio,
  };
}

export function publicSalonCopy(state: DemoState, language: Locale): DemoState {
  const pack = getPack(state.pack);
  const categories = state.categories.map((category) => {
    const id = pack.categories.find((id) => id === category.id);
    if (!id) return category;
    const key = `category.${id}` as const;
    return category.name === translate("en", key) || category.name === translate("sv", key)
      ? { ...category, name: translate(language, key) } : category;
  });
  if (language === "en" || state.pack !== eko.id) return { ...state, categories };
  return {
    ...state,
    categories,
    salon: state.salon.tagline === eko.salon.tagline
      ? { ...state.salon, tagline: translate(language, "fixture.eko.tagline") } : state.salon,
    staff: state.staff.map((person) => staffCopy(person, language)),
    services: state.services.map((service) => serviceCopy(service, language)),
    retiredServices: state.retiredServices.map((service) => serviceCopy(service, language)),
  };
}

/** Keep the other language's fixture names searchable without including hidden treatments. */
export function fixtureServiceAliases(service: Service): string[] {
  const original = eko.services.find(({ id }) => id === service.id);
  if (!original) return [service.name];
  const swedish = serviceCopy(original, "sv").name;
  return service.name === original.name || service.name === swedish ? [original.name, swedish] : [service.name];
}
