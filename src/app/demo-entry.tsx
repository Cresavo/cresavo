"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function DemoEntry() {
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
                "Demoadmin kunde inte öppnas. Försök igen eller använd vanlig inloggning.",
              );
              return;
            }
            router.push("/admin");
            router.refresh();
          } catch {
            setError("Anslutningen avbröts. Försök igen.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Öppnar arbetsytan…" : "Öppna demoadmin"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
