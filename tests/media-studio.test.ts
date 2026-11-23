import { describe, expect, it } from "vitest";
import { newDraft, withLibraryPhoto } from "@/concept/campaigns/draft";
import { normalizeTheme } from "@/concept/page/theme";
import { libraryIdOf, namesLibraryPhoto, ownerMediaUrl, publicLogoUrl } from "@/lib/media/limits";
import { ownerAction } from "@/lib/owner-store";

const ID = "7c1e4f3a-1b2c-4d5e-8f90-123456789abc";
const SHA = "ab".repeat(32);

describe("library pictures in the studio", () => {
  it("starts a campaign with a library photo, and ignores anything else", () => {
    const draft = { ...newDraft({ name: "Fictional offer", serviceIds: [], discountPercent: 10, from: "2026-11-22", to: "2026-12-05" }), style: "typography" as const };
    expect(withLibraryPhoto(draft, ID)).toMatchObject({ style: "fullphoto", posterEdits: { image: ownerMediaUrl(ID) } });
    expect(withLibraryPhoto({ ...draft, style: "price" }, ID).style).toBe("price");
    for (const bad of [null, "", "../../api/owner/salon", "javascript:alert(1)", ID.toUpperCase()]) expect(withLibraryPhoto(draft, bad)).toBe(draft);
    expect(libraryIdOf(ownerMediaUrl(ID))).toBe(ID);
    expect(libraryIdOf("/demo/salon.webp")).toBeNull();
  });

  it("names a library photo in a poster request only by its media reference", () => {
    expect(namesLibraryPhoto({ data: { photo: `media:${ID}` } })).toBe(true);
    expect(namesLibraryPhoto({ data: { before: `media:${ID}` } })).toBe(true);
    expect(namesLibraryPhoto({ data: { photo: "data:image/png;base64,AAAA" } })).toBe(false);
    expect(namesLibraryPhoto(null)).toBe(false);
    expect(namesLibraryPhoto({ data: "media:x" })).toBe(false);
  });

  it("lets the booking page use an uploaded logo by its public address, and nothing else that is not a small image", () => {
    expect(normalizeTheme({ logo: publicLogoUrl(ID, SHA) }).logo).toBe(publicLogoUrl(ID, SHA));
    for (const bad of [ownerMediaUrl(ID), `${publicLogoUrl(ID, SHA)}?x=1`, `https://elsewhere.example${publicLogoUrl(ID, SHA)}`, "data:image/svg+xml;base64,PHN2Zz4="]) {
      expect(normalizeTheme({ logo: bad }).logo, bad).toBeNull();
    }
    const page = { theme: { logo: publicLogoUrl(ID, SHA), logoColors: [], colors: null, fonts: "modern", corners: "soft", heroPhoto: "salon" }, sections: [], instagram: "", css: "", about: { heading: "", text: "" } };
    expect(ownerAction({ type: "page/set", page })).not.toBeNull();
    expect(ownerAction({ type: "page/set", page: { ...page, theme: { ...page.theme, logo: ownerMediaUrl(ID) } } })).toBeNull();
  });
});
