"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
export type CustomerChoice = { id: string; name: string };
export default function CustomerPicker({
  value,
  onChange,
}: {
  value?: CustomerChoice;
  onChange: (value?: CustomerChoice) => void;
}) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<CustomerChoice[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const request = useRef(0);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    const sequence = ++request.current;
    setPending(true);
    setError("");
    setRows([]);
    try {
      const response = await fetch(
        `/api/admin/customers?q=${encodeURIComponent(query)}&limit=10`,
        { cache: "no-store" },
      );
      if (!response.ok) throw Error();
      const data = await response.json();
      if (sequence !== request.current) return;
      setRows(data.customers);
      if (!data.customers.length)
        setError(
          t(
            "No customers found. Try another search or create a customer.",
            "Inga kunder hittades. Prova en annan sökning eller skapa ett kundkort.",
          ),
        );
    } catch {
      if (sequence === request.current)
        setError(
          t(
            "Could not load customers. Try again.",
            "Kunderna kunde inte hämtas. Försök igen.",
          ),
        );
    } finally {
      if (sequence === request.current) setPending(false);
    }
  }
  return (
    <section
      className="panel customer-picker"
      aria-label={t("Choose customer", "Välj kund")}
    >
      <h2>{t("Customer", "Kund")}</h2>
      {value ? (
        <>
          <p>
            {t("Selected customer:", "Vald kund:")}{" "}
            <strong>{value.name}</strong>
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => onChange(undefined)}
          >
            {t("Change customer", "Byt kund")}
          </button>
          <Link href={`/admin/customers/${encodeURIComponent(value.id)}`}>
            {t("Open customer", "Öppna kundkort")}
          </Link>
        </>
      ) : (
        <>
          <form onSubmit={search} className="action-row">
            <div className="field">
              <label htmlFor="booking-customer-search">
                {t("Find an existing customer", "Sök befintlig kund")}
              </label>
              <input
                id="booking-customer-search"
                value={query}
                onChange={(e) => {
                  request.current++;
                  setPending(false);
                  setRows([]);
                  setError("");
                  setQuery(e.target.value);
                }}
                maxLength={80}
              />
            </div>
            <button disabled={pending}>
              {pending
                ? t("Searching…", "Söker…")
                : t("Find customer", "Sök kund")}
            </button>
          </form>
          <ul className="customer-choices">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    onChange(c);
                    setRows([]);
                  }}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          {error && <p role="status">{error}</p>}
          <p>
            <Link href="/admin/customers/new">
              {t("Create a customer", "Skapa nytt kundkort")}
            </Link>{" "}
            {t(
              "or enter a standalone booking below.",
              "eller fyll i en fristående bokning nedan.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
