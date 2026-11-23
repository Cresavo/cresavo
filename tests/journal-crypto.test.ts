import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJournal, encryptJournal, journalAad, journalKey, JournalUnreadable, type JournalKey } from "@/concept/store/journal-crypto";

// Encryption at rest for server-side journals: a round trip, a changed byte, another key and the associated data
// that binds a version to its tenant, customer, entry and version. Keys are made at run time; all text is invented.

const keyValue = (version = 1) => `v${version}:${randomBytes(32).toString("base64")}`;
const key = journalKey(keyValue())!;
const place = { tenantId: "salon_fictional-a", customerId: "c-1", id: "j-7", version: 2 };
const content = { treatment: "Fictional foot care", observations: "Dry skin on the left heel", advice: "Moisturise daily", nextVisit: "In 6 weeks", photos: { before: "/demo/salon.webp" } };

const flip = (buffer: Buffer, at: number) => {
  const copy = Buffer.from(buffer);
  copy[at] ^= 0x01;
  return copy;
};

describe("journal encryption", () => {
  it("reads the key only as v<N>: and 32 bytes of base64", () => {
    expect(key.version).toBe(1);
    expect(key.key).toHaveLength(32);
    expect(journalKey(keyValue(7))?.version).toBe(7);
    expect(journalKey(undefined)).toBeNull();
    expect(journalKey("")).toBeNull();
    expect(journalKey(randomBytes(32).toString("base64"))).toBeNull();
    expect(journalKey(`v1:${randomBytes(16).toString("base64")}`)).toBeNull();
    expect(journalKey(`v0:${randomBytes(32).toString("base64")}`)).toBeNull();
    expect(journalKey(`v1:${randomBytes(32).toString("hex")}`)).toBeNull();
  });

  it("round-trips the content in its canonical form, with a fresh IV every time", () => {
    const a = encryptJournal(content, place, key);
    const b = encryptJournal(content, place, key);
    expect(a.iv).toHaveLength(12);
    expect(a.keyVersion).toBe(1);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.ciphertext.toString("utf8")).not.toContain("Fictional");
    expect(decryptJournal(a, place, key)).toEqual(content);
    const bare = encryptJournal({ treatment: "", observations: "x", advice: "", nextVisit: "", photos: {} }, place, key);
    expect(decryptJournal(bare, place, key)).toEqual({ treatment: "", observations: "x", advice: "" });
  });

  it("refuses a changed ciphertext, tag or IV", () => {
    const row = encryptJournal(content, place, key);
    expect(() => decryptJournal({ ...row, ciphertext: flip(row.ciphertext, 0) }, place, key)).toThrow(JournalUnreadable);
    expect(() => decryptJournal({ ...row, ciphertext: flip(row.ciphertext, row.ciphertext.length - 1) }, place, key)).toThrow(JournalUnreadable);
    expect(() => decryptJournal({ ...row, iv: flip(row.iv, 3) }, place, key)).toThrow(JournalUnreadable);
    expect(() => decryptJournal({ ...row, ciphertext: row.ciphertext.subarray(0, 10) }, place, key)).toThrow(JournalUnreadable);
    expect(() => decryptJournal({ ...row, iv: row.iv.subarray(0, 8) }, place, key)).toThrow(JournalUnreadable);
  });

  it("refuses another key, and a row that names another key version", () => {
    const row = encryptJournal(content, place, key);
    const other: JournalKey = journalKey(keyValue())!;
    expect(() => decryptJournal(row, place, other)).toThrow(JournalUnreadable);
    expect(() => decryptJournal({ ...row, keyVersion: 2 }, place, key)).toThrow(JournalUnreadable);
    const sameBytesNewVersion: JournalKey = { version: 2, key: key.key };
    expect(() => decryptJournal(row, place, sameBytesNewVersion)).toThrow(JournalUnreadable);
  });

  it("binds each version to its tenant, customer, entry and version", () => {
    const row = encryptJournal(content, place, key);
    for (const moved of [
      { ...place, tenantId: "salon_fictional-b" }, { ...place, customerId: "c-2" }, { ...place, id: "j-8" }, { ...place, version: 1 }, { ...place, version: 3 },
    ]) {
      expect(() => decryptJournal(row, moved, key), JSON.stringify(moved)).toThrow(JournalUnreadable);
    }
    expect(journalAad(place).toString()).toBe("cresavo-journal:v1|salon_fictional-a|c-1|j-7|2");
    // A part holding the separator could make two places share associated data: refused.
    expect(() => journalAad({ ...place, customerId: "c|1" })).toThrow(RangeError);
    expect(() => journalAad({ ...place, version: 0 })).toThrow(RangeError);
    expect(() => encryptJournal(content, { ...place, id: "" }, key)).toThrow(RangeError);
  });
});
