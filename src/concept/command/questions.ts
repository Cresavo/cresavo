import { t } from "../i18n";
import { en } from "../i18n/en";
import type { QuestionKey } from "../intent/types";

const keys = Object.keys(en.messages).filter((key): key is QuestionKey => key.startsWith("command.question."));
const exact = new Map(keys.map((key) => [en.messages[key] as string, key]));
const withName = keys.filter((key) => en.messages[key].includes("{name}")).map((key) => {
  const [prefix, suffix] = en.messages[key].split("{name}");
  return { key, prefix, suffix };
});

export function questionText(question: string): string {
  const key = exact.get(question);
  if (key) return t(key);
  const match = withName.find(({ prefix, suffix }) => question.startsWith(prefix) && question.endsWith(suffix));
  return match ? t(match.key, { name: question.slice(match.prefix.length, -match.suffix.length) }) : t("command.notUnderstood");
}
