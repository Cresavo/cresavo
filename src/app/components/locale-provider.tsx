"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveHost } from "@/concept/page/resolve";
import { englishConceptPath } from "@/concept/page/language";
import { text, type Locale } from "@/lib/locale";

const LocaleContext = createContext<Locale>("sv");
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
export function useLocale() {
  return useContext(LocaleContext);
}

/** The root layout persists across client navigation. Keep its language in sync with the page. */
export function DocumentLanguage({ locale }: { locale: Locale }) {
  const path = usePathname();
  useEffect(() => {
    // A rewritten tenant URL can be "/", "/me", or another public path.
    const host = resolveHost(window.location.host);
    const concept = englishConceptPath(path ?? "") || host.kind === "business" || host.kind === "unknown";
    document.documentElement.lang = concept ? "en" : locale;
  }, [path, locale]);
  return null;
}

export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function change(value: Locale) {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      // Refresh server text without losing the current route or client form state.
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="language-switch">
      <label>
        <span className="sr-only">{text(locale, "Language", "Språk")}</span>
        <select
          aria-label={text(locale, "Language", "Språk")}
          value={locale}
          disabled={pending}
          onChange={(event) => void change(event.target.value as Locale)}
        >
          <option value="en">English</option>
          <option value="sv">Svenska</option>
        </select>
      </label>
      {error && (
        <span role="alert">
          {text(
            locale,
            "Could not change language. Try again.",
            "Språket kunde inte ändras. Försök igen.",
          )}
        </span>
      )}
    </span>
  );
}
