"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, MessageCircle, Phone, Plus, Search, type LucideIcon } from "lucide-react";
import { t } from "../i18n";
import { canOpen, type Role } from "../ops/access";
import { IconButton } from "../ui/button";
import { ListRow } from "../ui/list-row";
import { Sheet } from "../ui/sheet";
import { openAssistant } from "./assistant/thread-store";
import { BookingSheets, type OpenSheet } from "./booking/booking-sheets";

const CUSTOMERS = "/studio/customers";

/**
 * Phones: a plus in the masthead opens the four things an owner does most, over
 * whatever page they are on. Each action reuses an existing sheet or page.
 */
export function QuickActions({ role, assistant }: { role: Role; assistant: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  const actions: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: t("calendar.newBooking"), icon: CalendarPlus, run: run(() => setSheet({ kind: "new", preset: {} })) },
    ...(canOpen(role, CUSTOMERS) ? [{ label: t("quick.findCustomer"), icon: Search, run: run(() => router.push(CUSTOMERS)) }] : []),
    { label: t("today.phoneMode"), icon: Phone, run: run(() => setSheet({ kind: "phone" })) },
    ...(assistant ? [{ label: t("quick.ask"), icon: MessageCircle, run: run(() => openAssistant()) }] : []),
  ];
  return (
    <>
      <IconButton label={t("quick.title")} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Plus size={22} aria-hidden />
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("quick.title")}>
        <ul>
          {actions.map(({ label, icon: Icon, run }) => (
            <li key={label}>
              <ListRow onClick={run} title={<span className="text-h3 font-semibold">{label}</span>} leading={<Icon size={22} aria-hidden className="shrink-0" />} />
            </li>
          ))}
        </ul>
      </Sheet>
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
