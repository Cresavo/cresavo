"use client";
import Link from "next/link";
import { useRef, useState } from "react";
export type CustomerChoice = { id: string; name: string };
export default function CustomerPicker({
  value,
  onChange,
}: {
  value?: CustomerChoice;
  onChange: (value?: CustomerChoice) => void;
}) {
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
          "Inga kunder hittades. Prova en annan sökning eller skapa ett kundkort.",
        );
    } catch {
      if (sequence === request.current)
        setError("Kunderna kunde inte hämtas. Försök igen.");
    } finally {
      if (sequence === request.current) setPending(false);
    }
  }
  return (
    <section className="panel customer-picker" aria-label="Välj kund">
      <h2>Kund</h2>
      {value ? (
        <>
          <p>
            Vald kund: <strong>{value.name}</strong>
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => onChange(undefined)}
          >
            Byt kund
          </button>
          <Link href={`/admin/customers/${encodeURIComponent(value.id)}`}>
            Öppna kundkort
          </Link>
        </>
      ) : (
        <>
          <form onSubmit={search} className="action-row">
            <div className="field">
              <label htmlFor="booking-customer-search">
                Sök befintlig kund
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
              {pending ? "Söker…" : "Sök kund"}
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
            <Link href="/admin/customers/new">Skapa nytt kundkort</Link> eller
            fyll i en fristående bokning nedan.
          </p>
        </>
      )}
    </section>
  );
}
