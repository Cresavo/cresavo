"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceView } from "../types";
import { useWrite, useUnsavedChanges } from "../use-write";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
export default function ServiceEditor({ service }: { service?: ServiceView }) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const router = useRouter();
  const { write, pending, message, status } = useWrite();
  const { markDirty, markClean } = useUnsavedChanges();
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      price = String(form.get("price")).replace(",", ".");
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(price)) {
      setError(
        t(
          "Enter the price in SEK, for example 650.00.",
          "Ange pris i kronor, till exempel 650,00.",
        ),
      );
      return;
    }
    const [whole, fraction = ""] = price.split(".");
    setError("");
    const result = await write<{ id: string }>("/api/admin/services", {
      ...(service && { id: service.id, expectedVersion: service.version }),
      name: form.get("name"),
      priceOre: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
      duration: Number(form.get("duration")),
      buffer: Number(form.get("buffer")),
      active: form.get("active") === "on",
    });
    if (result) {
      markClean();
      router.push(
        `/admin/services?id=${encodeURIComponent(result.id)}&saved=1`,
      );
      router.refresh();
    }
  }
  return (
    <form onSubmit={save} onChange={markDirty}>
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="service-name">{t("Name", "Namn")}</label>
          <input
            id="service-name"
            name="name"
            minLength={2}
            maxLength={80}
            defaultValue={service?.name ?? ""}
            required
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="service-price">
              {t("Price (SEK)", "Pris (kr)")}
            </label>
            <input
              id="service-price"
              name="price"
              inputMode="decimal"
              defaultValue={
                service
                  ? (service.priceOre / 100)
                      .toFixed(2)
                      .replace(".", locale === "sv" ? "," : ".")
                  : ""
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="service-duration">
              {t("Treatment duration (min)", "Behandlingstid (min)")}
            </label>
            <input
              id="service-duration"
              name="duration"
              type="number"
              min={5}
              max={480}
              step={1}
              defaultValue={service?.duration ?? 30}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="service-buffer">
              {t("Buffer afterwards (min)", "Buffert efteråt (min)")}
            </label>
            <input
              id="service-buffer"
              name="buffer"
              type="number"
              min={0}
              max={120}
              step={1}
              defaultValue={service?.buffer ?? 0}
              required
            />
          </div>
        </div>
        <label className="check-label field">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service?.active ?? true}
          />
          {t("Available for new bookings", "Aktiv för nya bokningar")}
        </label>
        <p className="muted field">
          {t(
            "Existing bookings keep their name, price and time. Assign new treatments under Team & schedules.",
            "Befintliga bokningar behåller namn, pris och bokad tid. Tilldela nya behandlingar under Personal & tider.",
          )}
        </p>
        <div className="action-row editor-actions">
          <button>
            {pending
              ? t("Saving…", "Sparar…")
              : t("Save treatment", "Spara behandling")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              markClean();
              router.replace("/admin/services");
            }}
          >
            {t("Cancel", "Avbryt")}
          </button>
        </div>
      </fieldset>
      {(error || message) && (
        <p role="alert" className="form-error">
          {error || presentationError(message, locale)}
        </p>
      )}
      {status === 409 && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            markClean();
            window.location.reload();
          }}
        >
          {t("Reload latest details", "Läs in uppgifterna på nytt")}
        </button>
      )}
    </form>
  );
}
