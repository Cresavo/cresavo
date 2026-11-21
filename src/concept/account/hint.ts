/** Readable by the studio, holds no secret: "an owner may be signed in here". Set and cleared with the session cookie. */
export const OWNER_HINT_COOKIE = "cresavo_owner_hint";

export const ownerHintPresent = (cookie: string) => cookie.split(";").some((part) => part.trim() === `${OWNER_HINT_COOKIE}=1`);
