"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ExternalLink, MessageCircle, Phone, Plus, Search, type LucideIcon } from "lucide-react";
import { t } from "../i18n";
import { canOpen, type Role } from "../ops/access";
import { ActionMenu } from "../ui/popover";
import { openAssistant } from "./assistant/thread-store";
import { BookingSheets, type OpenSheet } from "./booking/booking-sheets";

const CUSTOMERS = "/studio/customers";

/**
 * Phones: a plus in the masthead opens the things an owner does most, over
 * whatever page they are on, in a short menu that grows from the plus. Each
 * action reuses an existing sheet or page.
 */
export function QuickActions({ role, assistant, page }: { role: Role; assistant: boolean; /** The salon's public booking page. */ page: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const actions: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: t("calendar.newBooking"), icon: CalendarPlus, run: () => setSheet({ kind: "new", preset: {} }) },
    ...(canOpen(role, CUSTOMERS) ? [{ label: t("quick.findCustomer"), icon: Search, run: () => router.push(CUSTOMERS) }] : []),
    { label: t("today.phoneMode"), icon: Phone, run: () => setSheet({ kind: "phone" }) },
    ...(assistant ? [{ label: t("quick.ask"), icon: MessageCircle, run: () => openAssistant() }] : []),
    { label: t("quick.viewPage"), icon: ExternalLink, run: () => router.push(page) },
  ];
  return (
    <>
      <ActionMenu title={t("quick.title")}
        items={actions.map(({ label, icon: Icon, run }) => ({ label, run, icon: <Icon size={20} aria-hidden className="shrink-0" /> }))}
        icon={<Plus size={22} aria-hidden />} />
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
