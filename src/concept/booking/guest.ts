import type { CheckoutHold } from "./protection";
import { useRef, useState } from "react";

// Contact prefill is separate from the salon's fictional booking records.
export interface Guest {
  name: string;
  phone: string;
  customerId: string;
}

const key = (slug: string) => `booking-guest-opt-in:${slug}`;

export function recallGuest(slug: string): Guest | undefined {
  try {
    window.localStorage.removeItem("salong-eko-guest"); // Older versions saved contacts without asking.
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return;
    const guest = JSON.parse(raw);
    if (typeof guest?.customerId === "string" && typeof guest.name === "string" && typeof guest.phone === "string") return guest;
  } catch {
    // The browser may block storage, especially in an embedded widget.
  }
}

export function rememberGuest(slug: string, guest?: Guest) {
  try {
    if (guest) window.localStorage.setItem(key(slug), JSON.stringify(guest));
    else window.localStorage.removeItem(key(slug));
  } catch {
    // The booking can still succeed without prefill.
  }
}

export function rememberHeldGuest(slug: string, hold: CheckoutHold, customerId: string) {
  rememberGuest(slug, { name: hold.guest.name, phone: hold.guest.phone, customerId });
}

/** Both guest forms use the same opt-in and forget the prefill immediately on opt-out. */
export function useGuestContact(slug: string) {
  const [known] = useState(() => recallGuest(slug));
  const [guest, setGuest] = useState({ name: known?.name ?? "", phone: known?.phone ?? "" });
  const [choice, setChoice] = useState<boolean>();
  const latestChoice = useRef<boolean | undefined>(undefined);
  const sameContact = !!known && known.name === guest.name.trim() && known.phone === guest.phone.trim();
  const remember = choice ?? sameContact;
  function chooseRemember(allowed: boolean) {
    latestChoice.current = allowed;
    if (!allowed) rememberGuest(slug);
    setChoice(allowed);
  }
  function saveContact(customerId: string) {
    // An earlier opt-in belongs to that contact. Another form may since have cleared it.
    const allowed = latestChoice.current ?? (sameContact && recallGuest(slug)?.customerId === known?.customerId);
    rememberGuest(slug, allowed ? { name: guest.name.trim(), phone: guest.phone.trim(), customerId } : undefined);
  }
  return { guest, setGuest, remember, chooseRemember, saveContact, explicitlyRemembers: () => latestChoice.current === true };
}
