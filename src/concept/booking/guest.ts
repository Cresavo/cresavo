// The demo has no login. This browser remembers who booked last, so the form is prefilled
// and "My bookings" opens straight away. Nothing leaves the browser.

const KEY = "salong-eko-guest";

export interface Guest {
  name: string;
  phone: string;
  customerId: string;
}

export function recallGuest(): Guest | undefined {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Guest) : undefined;
  } catch {
    return undefined;
  }
}

export function rememberGuest(guest: Guest) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(guest));
  } catch {
    // Remembering is a convenience only.
  }
}
