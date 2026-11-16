import { en } from "./en";

// All user-facing studio text goes through `t()`. To add a language, create a
// dictionary with the same shape as `en.ts` and select it here.

const dictionary = en;

export type MessageKey = keyof typeof dictionary.messages;
type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;

export function t(key: MessageKey, vars?: Vars): string {
  return fill(dictionary.messages[key], vars);
}

/** Messages written as "one|many" pick a form by `count`, which is also available as {count}. */
export function tc(key: MessageKey, count: number, vars?: Vars): string {
  const [one, many = one] = dictionary.messages[key].split("|");
  return fill(count === 1 ? one : many, { count, ...vars });
}

export const words = dictionary.words;
export const locale = dictionary.locale;
