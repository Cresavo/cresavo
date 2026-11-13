"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWrite, useUnsavedChanges } from "../use-write";
import {
  contextualHref,
  returnHref,
  type ReturnContext,
} from "@/lib/navigation-context";

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
  context = {},
}: {
  customer?: CustomerView;
  context?: ReturnContext;
}) {
  const router = useRouter(),
    { write, pending, message, status, clearFeedback } = useWrite();
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
      router.push(
        contextualHref(
          `/admin/customers/${encodeURIComponent(result.id)}`,
          context,
        ),
      );
    else {
      setNotice("Kundkortet är sparat. Äldre bokningar är oförändrade.");
      const href = new URL(location.href);
      href.searchParams.set("saved", "1");
      router.replace(href.pathname + href.search);
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
        <div className="action-row editor-actions">
          <button>
            {pending ? "Sparar…" : customer ? "Spara kundkort" : "Skapa kund"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={(event) => {
              clearFeedback();
              markClean();
              if (!customer) {
                location.assign(returnHref(context, "/admin/customers"));
                return;
              }
              event.currentTarget.form?.reset();
              const details = event.currentTarget.closest("details");
              if (details) {
                details.open = false;
                details.querySelector("summary")?.focus();
              }
              setNotice("Ändringarna har återställts.");
            }}
          >
            Avbryt
          </button>
        </div>
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
