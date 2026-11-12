"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceView } from "../types";
import { useWrite, useUnsavedChanges } from "../use-write";
export default function ServiceEditor({ service }: { service?: ServiceView }) {
  const router = useRouter();
  const { write, pending, message, status } = useWrite();
  const { markDirty, markClean } = useUnsavedChanges();
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      price = String(form.get("price")).replace(",", ".");
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(price)) {
      setError("Ange pris i kronor, till exempel 650,00.");
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
          <label htmlFor="service-name">Namn</label>
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
            <label htmlFor="service-price">Pris (kr)</label>
            <input
              id="service-price"
              name="price"
              inputMode="decimal"
              defaultValue={
                service
                  ? (service.priceOre / 100).toFixed(2).replace(".", ",")
                  : ""
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="service-duration">Behandlingstid (min)</label>
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
            <label htmlFor="service-buffer">Buffert efteråt (min)</label>
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
          Aktiv för nya bokningar
        </label>
        <p className="muted field">
          Befintliga bokningar behåller namn, pris och bokad tid. Tilldela nya
          behandlingar under Personal &amp; tider.
        </p>
        <button>{pending ? "Sparar…" : "Spara behandling"}</button>
      </fieldset>
      {(error || message) && (
        <p role="alert" className="form-error">
          {error || message}
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
          Läs in uppgifterna på nytt
        </button>
      )}
    </form>
  );
}
