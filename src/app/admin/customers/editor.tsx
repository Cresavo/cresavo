"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWrite, useUnsavedChanges } from "../use-write";

export type CustomerView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  archived: boolean;
  version: number;
  contactVisible: boolean;
  contactRemovedAt: string | null;
};
export default function CustomerEditor({
  customer,
}: {
  customer?: CustomerView;
}) {
  const router = useRouter(),
    { write, pending, message, status } = useWrite();
  const [notice, setNotice] = useState("");
  const { markDirty, markClean } = useUnsavedChanges();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? ""),
      phone = String(form.get("phone") ?? "");
    const result = await write<{ id: string; version: number }>(
      "/api/admin/customers",
      {
        action: customer ? "edit" : "create",
        name: form.get("name"),
        ...(!customer || customer.contactVisible || email ? { email } : {}),
        ...(!customer || customer.contactVisible || phone
          ? { phone: phone || null }
          : {}),
        ...(customer && {
          id: customer.id,
          expectedVersion: customer.version,
          archived: form.get("archived") === "on",
        }),
      },
    );
    if (!result) return;
    markClean();
    if (!customer)
      router.push(`/admin/customers/${encodeURIComponent(result.id)}`);
    else {
      setNotice("Kundkortet är sparat. Äldre bokningar är oförändrade.");
      router.replace(
        `/admin/customers/${encodeURIComponent(customer.id)}?saved=1`,
      );
      router.refresh();
    }
  }
  return (
    <form onSubmit={save} onChange={markDirty} className="customer-editor">
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="customer-name">Namn (påhittat)</label>
          <input
            id="customer-name"
            name="name"
            defaultValue={customer?.name}
            minLength={2}
            maxLength={80}
            required
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="customer-email">E-post (testadress)</label>
          <input
            id="customer-email"
            name="email"
            type="email"
            defaultValue={customer?.contactVisible ? customer.email : ""}
            maxLength={254}
            required={!customer}
            placeholder={
              customer && !customer.contactVisible
                ? "Dold – lämna tomt för att behålla"
                : "namn@example.test"
            }
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="customer-phone">Telefon (valfritt)</label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            defaultValue={
              customer?.contactVisible ? (customer.phone ?? "") : ""
            }
            maxLength={30}
            autoComplete="off"
          />
          <small>Använd inte verkliga telefonnummer. Lämna gärna tomt.</small>
        </div>
        {customer && (
          <label className="archive-choice">
            <input
              name="archived"
              type="checkbox"
              defaultChecked={customer.archived}
            />{" "}
            Arkivera kundkortet. Besökshistoriken finns kvar.
          </label>
        )}
        <button>
          {pending ? "Sparar…" : customer ? "Spara kundkort" : "Skapa kund"}
        </button>
      </fieldset>
      {message && (
        <p role="alert">
          {message}
          {status === 409 && (
            <>
              {" "}
              <button type="button" onClick={() => router.refresh()}>
                Läs in senaste version
              </button>
            </>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
