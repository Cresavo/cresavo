import type { Locale } from "@/lib/locale";
import { holidayCopy } from "../data/holidays";
import type { DemoState, Service, Staff, StockItem } from "../data/types";
import { getPack } from "../packs";
import { translate, type MessageKey } from ".";
import { en } from "./en";
import { fixtureInboxCopy } from "./fixture-inbox";

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

/** The two demo treatments that come with a longer text behind "More info". */
const detailsKeys: Partial<Record<string, MessageKey>> = {
  "spa-foot-care": "fixture.eko.service.spa.details",
  "classic-60": "fixture.eko.service.classic60.details",
};

function fixtureField(value: string, key: MessageKey, language: Locale): string {
  return value === translate("en", key) || value === translate("sv", key) ? translate(language, key) : value;
}

export function serviceCopy(service: Service, language: Locale): Service {
  const key = serviceKeys[service.id];
  if (!key) return service;
  const name = fixtureField(service.name, `${key}.name`, language);
  const description = fixtureField(service.description, `${key}.description`, language);
  const detailsKey = detailsKeys[service.id];
  const details = service.details && detailsKey ? fixtureField(service.details, detailsKey, language) : service.details;
  if (name === service.name && description === service.description && details === service.details) return service;
  return { ...service, name, description, ...(details ? { details } : {}) };
}

function staffCopy(person: Staff, language: Locale): Staff {
  if (person.id !== "anna" && person.id !== "erik") return person;
  return {
    ...person,
    title: fixtureField(person.title, `fixture.eko.staff.${person.id}.title`, language),
    bio: fixtureField(person.bio, `fixture.eko.staff.${person.id}.bio`, language),
    role: fixtureField(person.role, person.id === "anna" ? "fixture.eko.staff.owner" : "fixture.eko.staff.employee", language),
  };
}

function fixtureKeys(prefix: string): MessageKey[] {
  return (Object.keys(en.messages) as MessageKey[]).filter((key) => key.startsWith(prefix));
}

function fixtureLookup(keys: MessageKey[]) {
  return new Map(keys.flatMap((key) => [[translate("en", key), key], [translate("sv", key), key]] as const));
}

const reviewText = fixtureLookup(fixtureKeys("fixture.eko.review."));
const reviewReply = fixtureLookup(["fixture.review.reply.happy", "fixture.review.reply.unhappy"]);
const stockKeys = fixtureKeys("fixture.eko.stock.");
const stockCategories = fixtureLookup(fixtureKeys("fixture.eko.stockCategory."));
const stockUnits = fixtureLookup(fixtureKeys("fixture.eko.stockUnit."));
const costKeys = fixtureKeys("fixture.cost.");

function lookupCopy(value: string, lookup: ReadonlyMap<string, MessageKey>, language: Locale): string {
  const key = lookup.get(value);
  return key ? translate(language, key) : value;
}

export function stockCopy(item: StockItem, language: Locale): StockItem {
  const key = stockKeys.find((candidate) => candidate === `fixture.eko.stock.${item.id}`);
  if (!key) return item;
  return {
    ...item,
    name: fixtureField(item.name, key, language),
    category: lookupCopy(item.category, stockCategories, language),
    unit: lookupCopy(item.unit, stockUnits, language),
  };
}

/** Fixture translations belong to the view. Keep stored text and owner edits intact. */
export function salonCopy(state: DemoState, language: Locale): DemoState {
  if (state.industry) return state;
  const pack = getPack(state.pack);
  const categories = state.categories.map((category) => {
    const id = pack.categories.find((id) => id === category.id);
    return id ? { ...category, name: fixtureField(category.name, `category.${id}`, language) } : category;
  });
  if (state.pack !== eko.id) return { ...state, categories };
  return {
    ...state,
    categories,
    salon: { ...state.salon, tagline: fixtureField(state.salon.tagline, "fixture.eko.tagline", language) },
    staff: state.staff.map((person) => staffCopy(person, language)),
    services: state.services.map((service) => serviceCopy(service, language)),
    retiredServices: state.retiredServices.map((service) => serviceCopy(service, language)),
    reviews: state.reviews.map((review) => /^r(?:\d+|-ny-[12])$/.test(review.id) ? {
      ...review,
      text: lookupCopy(review.text, reviewText, language),
      reply: review.reply && lookupCopy(review.reply, reviewReply, language),
    } : review),
  };
}

export function studioSalonCopy(state: DemoState, language: Locale): DemoState {
  const salon = salonCopy(state, language);
  if (state.industry || state.pack !== eko.id) return salon;
  return {
    ...salon,
    inbox: fixtureInboxCopy(state, language),
    holidays: state.holidays.map((holiday) => holidayCopy(holiday, language)),
    costs: state.costs.map((cost) => {
      const key = costKeys.find((candidate) => candidate === `fixture.cost.${cost.id}`);
      return key ? { ...cost, label: fixtureField(cost.label, key, language) } : cost;
    }),
    stock: state.stock.map((item) => stockCopy(item, language)),
    resources: state.resources.map((resource) => {
      const key = resource.id === "room-1" ? "fixture.eko.room.1" : resource.id === "room-2" ? "fixture.eko.room.2" : undefined;
      return key ? { ...resource, name: fixtureField(resource.name, key, language) } : resource;
    }),
    campaigns: state.campaigns.map((campaign) => {
      const key = campaign.id === "c-autumn" ? "fixture.eko.campaign.autumn" : campaign.id === "c-bundle" ? "fixture.eko.campaign.bundle" : undefined;
      return key ? { ...campaign, name: fixtureField(campaign.name, key, language) } : campaign;
    }),
  };
}

/** Keep both fixture names searchable and retain custom treatment names. */
export function fixtureServiceAliases(service: Service): string[] {
  const key = serviceKeys[service.id];
  if (!key) return [service.name];
  return [...new Set([fixtureField(service.name, `${key}.name`, "en"), fixtureField(service.name, `${key}.name`, "sv")])];
}

export function fixtureStockAliases(item: StockItem): string[] {
  const key = stockKeys.find((candidate) => candidate === `fixture.eko.stock.${item.id}`);
  return key ? [...new Set([fixtureField(item.name, key, "en"), fixtureField(item.name, key, "sv")])] : [item.name];
}
