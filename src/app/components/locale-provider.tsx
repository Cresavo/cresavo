"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveHost } from "@/concept/page/resolve";
import { conceptRoute } from "@/concept/page/language";
import { text, type Locale } from "@/lib/locale";

const noSubscription = () => () => {};
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

/** Studio and booking route boundaries set the document language once their browser state is ready. */
export function DocumentLanguage({ locale }: { locale: Locale }) {
  const path = usePathname();
  useEffect(() => {
    const route = conceptRoute(path ?? "");
    const host = resolveHost(window.location.host);
    if (route === "studio" || route === "booking" || host.kind === "business") return;
    document.documentElement.lang = route === "english" || host.kind === "unknown" ? "en" : locale;
  }, [path, locale]);
  return null;
}

export function EngineDemoBanner({ initialHidden }: { initialHidden: boolean }) {
  const path = usePathname();
  const locale = useLocale();
  const hidden = useSyncExternalStore(noSubscription, () => {
    const host = resolveHost(window.location.host);
    return Boolean(conceptRoute(path ?? "") || host.kind === "business" || host.kind === "unknown");
  }, () => initialHidden);
  if (hidden) return null;
  return (
    <aside className="demo-banner" aria-label={text(locale, "Demo notice", "Demoinformation")}>
      <span>{text(locale, "Demo — fictional data only", "Demo – endast påhittade uppgifter")}</span>
      <LanguageSwitch />
    </aside>
  );
}

export function LanguageSwitch({ labels }: { labels?: { name: string; error: string; en: string; sv: string } } = {}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const label = labels?.name ?? text(locale, "Language", "Språk");
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
        <span className="sr-only">{label}</span>
        <select
          aria-label={label}
          value={locale}
          disabled={pending}
          onChange={(event) => void change(event.target.value as Locale)}
        >
          <option value="en" lang="en">{labels?.en ?? "English"}</option>
          <option value="sv" lang="sv">{labels?.sv ?? "Svenska"}</option>
        </select>
      </label>
      {error && (
        <span role="alert">
          {labels?.error ?? text(
            locale,
            "Could not change language. Try again.",
            "Språket kunde inte ändras. Försök igen.",
          )}
        </span>
      )}
    </span>
  );
}
