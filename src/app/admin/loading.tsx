"use client";
import { useLocale } from "../components/locale-provider";
import { text } from "@/lib/locale";
export default function Loading() {
  const locale = useLocale();
  return (
    <main className="admin-workspace" aria-busy="true">
      <p role="status">
        {text(locale, "Loading workspace…", "Hämtar arbetsytan…")}
      </p>
    </main>
  );
}
