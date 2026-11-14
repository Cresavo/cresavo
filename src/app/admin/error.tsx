"use client";
import { useLocale } from "../components/locale-provider";
import { text } from "@/lib/locale";
export default function Error({ reset }: { reset: () => void }) {
  const locale = useLocale();
  return (
    <main className="admin-workspace">
      <h1>
        {text(
          locale,
          "Could not load the workspace",
          "Arbetsytan kunde inte hämtas",
        )}
      </h1>
      <p role="alert">
        {text(locale, "Please try again shortly.", "Försök igen om en stund.")}
      </p>
      <button onClick={reset}>
        {text(locale, "Try again", "Försök igen")}
      </button>
    </main>
  );
}
