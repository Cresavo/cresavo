// Custom CSS for the booking page. The owner's text is never put on the page
// as written: it is parsed, and only rules and declarations that are known to
// be harmless are written back out, each rule under the booking page root.
// Anything containing a backslash (CSS escapes can spell any keyword) is dropped.
// What is not understood is dropped. No JavaScript can come out of this: there
// is no `<`, no backslash, no `@import`, no external URL, no `url()` outside
// background images from this site, no legacy script hooks.

/** The class on the element that wraps the whole booking page. */
export const PAGE_ROOT = ".booking-theme";

export const MAX_CSS_LENGTH = 8000;
const MAX_RULES = 200;
const MAX_SELECTOR_LENGTH = 200;

const PROPERTY = new RegExp(
  "^(?:--[a-z0-9-]+|color|background(?:-color|-image|-position|-size|-repeat)?|border(?:-[a-z]+)*|outline(?:-[a-z]+)*|box-shadow|text-shadow|opacity|font(?:-[a-z]+)*|letter-spacing|word-spacing|line-height|" +
    "text-(?:align|transform|decoration(?:-[a-z]+)?|indent|underline-offset|wrap|overflow)|white-space|vertical-align|margin(?:-[a-z]+)*|padding(?:-[a-z]+)*|gap|row-gap|column-gap|" +
    "(?:min-|max-)?(?:width|height)|display|flex(?:-[a-z]+)*|grid(?:-[a-z]+)*|(?:justify|align|place)-[a-z]+|order|overflow(?:-[a-z]+)?|object-(?:fit|position)|aspect-ratio|" +
    "position|accent-color|list-style(?:-[a-z]+)?|cursor|filter|transform)$",
);
/** Success, warning, danger and info mean the same on every page; the owner's CSS cannot redefine them. */
const SEMANTIC = /^--ui-(?:success|warning|danger|info)(?:-bg)?$/;
const BANNED_VALUE = ["expression(", "javascript:", "vbscript:", "behavior", "-moz-binding", "@import", "image-set(", "src(", "element(", "data:", "<", "\\"];
const SAFE_IMAGE = /^\/(?!\/)[\w\-./]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i;
const URL_CALL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi;
const IMAGE_PROPERTIES = new Set(["background", "background-image"]);

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, " ");
const clean = (text: string) => stripComments(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<]/g, "");

/** Splits at `separator` outside quotes and brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

interface Block {
  prelude: string;
  body: string;
}

/** Top-level `prelude { body }` blocks. Text outside blocks (stray declarations, `@charset x;`) is ignored. */
function blocks(text: string): Block[] {
  const found: Block[] = [];
  let depth = 0;
  let quote = "";
  let preludeStart = 0;
  let bodyStart = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        found.push({ prelude: text.slice(preludeStart, bodyStart - 1).trim(), body: text.slice(bodyStart, i) });
        preludeStart = i + 1;
      }
    } else if (ch === ";" && depth === 0) preludeStart = i + 1;
  }
  return found;
}

function safeValue(property: string, raw: string): string | null {
  const value = raw.replace(/\s*!important\s*$/i, "").trim();
  const compact = value.toLowerCase().replace(/\s+/g, "");
  if (!value || BANNED_VALUE.some((word) => compact.includes(word))) return null;
  if (/[{};]/.test(value) || (value.match(/\(/g) ?? []).length !== (value.match(/\)/g) ?? []).length) return null;
  if (property === "position" && !["relative", "static"].includes(compact)) return null;
  if (compact.includes("url(")) {
    if (!IMAGE_PROPERTIES.has(property)) return null;
    let valid = true;
    const rest = value.replace(URL_CALL, (_match, double?: string, single?: string, bare?: string) => {
      const target = (double ?? single ?? bare ?? "").trim();
      if (!SAFE_IMAGE.test(target) || target.includes("..")) valid = false;
      return " ";
    });
    if (!valid || rest.replace(/\s+/g, "").toLowerCase().includes("url(")) return null;
  }
  return value;
}

function declarations(body: string): string[] {
  return splitTop(body, ";").flatMap((declaration) => {
    const colon = declaration.indexOf(":");
    if (colon < 1) return [];
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (!PROPERTY.test(property) || SEMANTIC.test(property)) return [];
    const value = safeValue(property, declaration.slice(colon + 1));
    return value ? [`${property}:${value}`] : [];
  });
}

const SELECTOR = /^[\w\s.#:\-[\]=^$*|~>+,()%]+$/;
const SELECTOR_STRING = /"[^"{};\\]*"|'[^'{};\\]*'/g;
const ROOT_WORDS = /^(?::root|html|body)(?![\w-])/i;

function scopeSelector(selector: string, scope: string): string | null {
  const text = selector.trim();
  if (!text || text.length > MAX_SELECTOR_LENGTH || !SELECTOR.test(text.replace(SELECTOR_STRING, "S"))) return null;
  return ROOT_WORDS.test(text) ? `${scope}${text.replace(ROOT_WORDS, "")}` : `${scope} ${text}`;
}

function rules(text: string, scope: string, nested: boolean, budget: { left: number }): string[] {
  return blocks(text).flatMap(({ prelude, body }) => {
    if (budget.left <= 0) return [];
    if (prelude.startsWith("@")) {
      if (nested || !/^@media\s+[a-z0-9\s:()\-.,>=/]+$/i.test(prelude)) return [];
      const inner = rules(body, scope, true, budget);
      return inner.length ? [`${prelude.replace(/\s+/g, " ")}{${inner.join("")}}`] : [];
    }
    const selectors = splitTop(prelude, ",").map((s) => scopeSelector(s, scope));
    const props = declarations(body);
    if (!props.length || selectors.some((s) => s === null)) return [];
    budget.left--;
    return [`${selectors.join(",")}{${props.join(";")}}`];
  });
}

/** Safe, scoped CSS for the booking page; an empty string when nothing in the input survives. */
export function sanitizeCss(input: string, scope = PAGE_ROOT): string {
  return rules(clean(input.slice(0, MAX_CSS_LENGTH)), scope, false, { left: MAX_RULES }).join("\n");
}
