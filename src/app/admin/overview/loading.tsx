"use client";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
export default function Loading() {
  const locale = useLocale();
  return (
    <main className="admin-workspace" role="status">
      {text(locale, "Loading current suggestions…", "Hämtar aktuella förslag…")}
    </main>
  );
}
