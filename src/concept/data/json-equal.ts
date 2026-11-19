// Equality with JSON semantics that ignores object key order. A document read
// back from Postgres (jsonb) has its keys in a different order from objects the
// reducer builds, so `JSON.stringify(a) === JSON.stringify(b)` would report a
// change where there is none.

type Json = unknown;

const dropped = (value: Json) => value === undefined || typeof value === "function" || typeof value === "symbol";

function normal(value: Json): Json {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (value && typeof value === "object" && typeof (value as { toJSON?: unknown }).toJSON === "function") return (value as { toJSON(): Json }).toJSON();
  return value;
}

/** True when `JSON.stringify` of both values would be equal up to object key order. */
export function jsonEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  const x = normal(a);
  const y = normal(b);
  if (x === y) return true;
  if (!x || !y || typeof x !== "object" || typeof y !== "object") return false;
  if (Array.isArray(x) !== Array.isArray(y)) return false;
  if (Array.isArray(x)) {
    const other = y as Json[];
    if (x.length !== other.length) return false;
    // In arrays JSON writes undefined and functions as null.
    return x.every((item, i) => jsonEqual(dropped(item) ? null : item, dropped(other[i]) ? null : other[i]));
  }
  const left = x as Record<string, Json>;
  const right = y as Record<string, Json>;
  const keys = Object.keys(left).filter((key) => !dropped(left[key]));
  const otherKeys = Object.keys(right).filter((key) => !dropped(right[key]));
  if (keys.length !== otherKeys.length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && !dropped(right[key]) && jsonEqual(left[key], right[key]));
}

/** `JSON.stringify` with object keys sorted, for fingerprints that must not depend on key order. */
export function canonicalJson(value: Json): string {
  const canonical = (item: Json): Json => {
    const v = normal(item);
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v).sort().map((key) => [key, canonical((v as Record<string, Json>)[key])]));
    }
    return v;
  };
  return JSON.stringify(canonical(value)) ?? "undefined";
}
