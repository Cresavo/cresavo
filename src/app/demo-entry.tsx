"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./components/locale-provider";
import { text } from "@/lib/locale";
export default function DemoEntry({ label }: { label?: string }) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <div className="demo-entry">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const r = await fetch("/api/demo/session", { method: "POST" });
            if (!r.ok) {
              setError(
                t(
                  "Could not open the demo workspace. Try again or use normal login.",
                  "Demoadmin kunde inte öppnas. Försök igen eller använd vanlig inloggning.",
                ),
              );
              return;
            }
            router.push("/admin");
            router.refresh();
          } catch {
            setError(
              t(
                "Connection interrupted. Try again.",
                "Anslutningen avbröts. Försök igen.",
              ),
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? t("Opening the workspace…", "Öppnar arbetsytan…")
          : (label ?? t("Open demo workspace", "Öppna demoadmin"))}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
