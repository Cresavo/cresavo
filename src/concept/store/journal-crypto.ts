import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { JournalContent } from "../data/types";
import { canonicalContent } from "../journals/sealed";

// Encryption at rest for journal entries (JOURNALS_ON_SERVER, GDPR art. 9 and
// 32; docs/legal/DPIA_JOURNAL.md). node:crypto only, the pattern of
// src/lib/owner-mfa-crypto.ts.
//
// JOURNAL_ENCRYPTION_KEY is `v<N>:` followed by 32 random bytes in base64
// (`echo "v1:$(openssl rand -base64 32)"`). N is the key version, stored on every
// row (`key_version`), so a later key can be told apart from this one. Each
// version of an entry is one AES-256-GCM message under a fresh 12-byte IV; the
// 16-byte tag is appended to the ciphertext. The associated data binds the
// message to its row (tenant, customer, entry and version), so ciphertext copied
// onto another row, salon or customer does not decrypt. Nothing here logs a
// key, a text or a ciphertext.

const KEY_PATTERN = /^v([1-9]\d{0,5}):([A-Za-z0-9+/]{43}=?)$/;
const TAG_BYTES = 16;
const IV_BYTES = 12;

export interface JournalKey {
  version: number;
  key: Buffer;
}

/** The configured key, or null when it is missing or not `v<N>:` plus 32 bytes of base64. */
export function journalKey(value = process.env.JOURNAL_ENCRYPTION_KEY): JournalKey | null {
  const parts = value ? KEY_PATTERN.exec(value.trim()) : null;
  if (!parts) return null;
  const key = Buffer.from(parts[2], "base64");
  return key.length === 32 ? { version: Number(parts[1]), key } : null;
}

/** Thrown when a stored version does not decrypt: another key, a changed row, or a row moved to another place. */
export class JournalUnreadable extends Error {
  constructor() { super("JOURNAL_UNREADABLE"); }
}

/** Where a stored version belongs. */
export interface JournalRowPlace {
  tenantId: string;
  customerId: string;
  id: string;
  version: number;
}

export interface SealedRow {
  ciphertext: Buffer;
  iv: Buffer;
  keyVersion: number;
}

/** The associated data: tenant_id|customer_id|id|version under a label. Ids never hold a `|` (refused). */
export function journalAad({ tenantId, customerId, id, version }: JournalRowPlace): Buffer {
  for (const part of [tenantId, customerId, id]) if (typeof part !== "string" || !part || part.includes("|")) throw new RangeError("JOURNAL_PLACE_INVALID");
  if (!Number.isInteger(version) || version < 1) throw new RangeError("JOURNAL_PLACE_INVALID");
  return Buffer.from(`cresavo-journal:v1|${tenantId}|${customerId}|${id}|${version}`, "utf8");
}

export function encryptJournal(content: JournalContent, place: JournalRowPlace, key: JournalKey): SealedRow {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key.key, iv).setAAD(journalAad(place));
  const body = Buffer.concat([cipher.update(JSON.stringify(canonicalContent(content)), "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([body, cipher.getAuthTag()]), iv, keyVersion: key.version };
}

const text = (value: unknown) => typeof value === "string";

function asContent(value: unknown): JournalContent {
  const record = value as Record<string, unknown> | null;
  if (!record || typeof record !== "object" || !text(record.treatment) || !text(record.observations) || !text(record.advice)) throw new JournalUnreadable();
  if (record.nextVisit !== undefined && !text(record.nextVisit)) throw new JournalUnreadable();
  const photos = record.photos as Record<string, unknown> | undefined;
  if (photos !== undefined && (typeof photos !== "object" || !photos || (photos.before !== undefined && !text(photos.before)) || (photos.after !== undefined && !text(photos.after)))) {
    throw new JournalUnreadable();
  }
  return canonicalContent(record as unknown as JournalContent);
}

export function decryptJournal(row: SealedRow, place: JournalRowPlace, key: JournalKey): JournalContent {
  if (row.keyVersion !== key.version || row.iv.length !== IV_BYTES || row.ciphertext.length < TAG_BYTES) throw new JournalUnreadable();
  let plain: string;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.key, row.iv).setAAD(journalAad(place));
    decipher.setAuthTag(row.ciphertext.subarray(row.ciphertext.length - TAG_BYTES));
    plain = Buffer.concat([decipher.update(row.ciphertext.subarray(0, row.ciphertext.length - TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    throw new JournalUnreadable();
  }
  try {
    return asContent(JSON.parse(plain));
  } catch {
    throw new JournalUnreadable();
  }
}

const VERIFIER_TEXT = "cresavo journal key check";
const verifierAad = (version: number) => Buffer.from(`cresavo-journal-key:v1|${version}`, "utf8");

/** The known value stored for a key version (`journal_key`), encrypted under that key. */
export function keyVerifier(key: JournalKey): { verifier: Buffer; iv: Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key.key, iv).setAAD(verifierAad(key.version));
  const body = Buffer.concat([cipher.update(VERIFIER_TEXT, "utf8"), cipher.final()]);
  return { verifier: Buffer.concat([body, cipher.getAuthTag()]), iv };
}

/** True when the key decrypts its version's stored verifier: the key the journals of that version were written with. */
export function verifiesKey(stored: { verifier: Buffer; iv: Buffer }, key: JournalKey): boolean {
  if (stored.iv.length !== IV_BYTES || stored.verifier.length < TAG_BYTES) return false;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.key, stored.iv).setAAD(verifierAad(key.version));
    decipher.setAuthTag(stored.verifier.subarray(stored.verifier.length - TAG_BYTES));
    const plain = Buffer.concat([decipher.update(stored.verifier.subarray(0, stored.verifier.length - TAG_BYTES)), decipher.final()]);
    return plain.toString("utf8") === VERIFIER_TEXT;
  } catch {
    return false;
  }
}
