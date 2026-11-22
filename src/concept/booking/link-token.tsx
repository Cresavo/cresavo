"use client";

import { useEffect } from "react";

// The token of a booking link lives in the address fragment, which the browser
// never sends. It is read once, removed from the address bar and history, and
// kept in memory for that page only: running an effect twice (React's strict
// mode) or showing an error screen instead of the booking cannot lose it or
// leave it in the address.

let held: { path: string; token: string } | undefined;

/** The token of this page's link, removing it from the address bar; the same one again on a second call. */
export function captureLinkToken(): string | undefined {
  const { pathname, search, hash } = window.location;
  const token = new URLSearchParams(hash.slice(1)).get("t");
  if (token) {
    held = { path: pathname, token };
    history.replaceState(null, "", pathname + search);
  }
  return held?.path === pathname ? held.token : undefined;
}

/** Mounted around every live booking page, so a token is removed from the address even where the booking is not shown. */
export function LinkTokenScrub() {
  useEffect(() => void captureLinkToken(), []);
  return null;
}
