"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  exportCustomerData,
  previewCustomerContactRemoval,
} from "@/lib/customer-data";
import { useWrite } from "../use-write";
import type { CustomerView } from "./editor";

type ExportFile = Awaited<ReturnType<typeof exportCustomerData>>;
type Preview = Awaited<ReturnType<typeof previewCustomerContactRemoval>>;
export default function CustomerDataPanel({
  customer,
}: {
  customer: CustomerView;
}) {
  const router = useRouter(),
    { write, pending, message } = useWrite();
  const [file, setFile] = useState<ExportFile | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    part: number;
  } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false),
    [complete, setComplete] = useState(false);
  const blob = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (blob.current) URL.revokeObjectURL(blob.current);
    },
    [],
  );
  const endpoint = `/api/admin/customers/${encodeURIComponent(customer.id)}/data`;
  async function prepareExport(next = false) {
    const result = await write<ExportFile>(endpoint, {
      action: "export",
      expectedVersion: customer.version,
      ...(next &&
        file?.nextCursor && {
          cursor: file.nextCursor,
          expectedToken: file.expectedToken,
        }),
    });
    if (!result) return;
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    setFile(result);
    setDownload({
      url: blob.current,
      part: next ? (download?.part ?? 0) + 1 : 1,
    });
  }
  async function prepareRemoval() {
    const result = await write<Preview>(endpoint, {
      action: "preview_removal",
      expectedVersion: customer.version,
    });
    if (result) {
      setPreview(result);
      setConfirmed(false);
    }
  }
  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview || !confirmed) return;
    const result = await write(endpoint, {
      action: "remove_contact",
      expectedVersion: preview.version,
      expectedToken: preview.expectedToken,
      confirmed: true,
    });
    if (!result) return;
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = null;
    setDownload(null);
    setFile(null);
    setPreview(null);
    setComplete(true);
    router.refresh();
  }
  return (
    <section
      className="panel customer-data-panel"
      aria-labelledby="customer-data-heading"
      aria-busy={pending}
    >
      <h2 id="customer-data-heading">Kunddata</h2>
      <p>
        Manuell hantering av påhittade uppgifter. Automatisk gallring är
        avstängd.
      </p>
      <details>
        <summary>Exportera kundkort och kopplade bokningar</summary>
        <p>
          Exporten innehåller kontaktuppgifter och uttryckligen kopplade
          bokningar, högst 100 per fil och 1000 totalt i POC:n. Fristående
          bokningar, loggar och backups ingår inte.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => prepareExport()}
        >
          Förbered export
        </button>
        {download && file && (
          <div className="export-ready" role="status">
            <p>
              Del {download.part}: {file.bookings.length} av totalt{" "}
              {file.totalLinkedBookings} kopplade bokningar.
            </p>
            <a
              className="button-link"
              href={download.url}
              download={`booking-lab-kunddata-del-${download.part}.json`}
            >
              Ladda ner kunddata, del {download.part}
            </a>
            {file.nextCursor ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => prepareExport(true)}
              >
                Förbered nästa del
              </button>
            ) : (
              <p>Detta är sista delen.</p>
            )}
          </div>
        )}
      </details>
      {customer.contactRemovedAt || complete ? (
        <p role="status">
          Kontaktuppgifterna är borttagna. Teknisk bokningshistorik finns kvar.
        </p>
      ) : (
        <details>
          <summary>Ta bort kontaktuppgifter</summary>
          <p>
            Detta skiljer sig från arkivering. Namn, e-post och telefon på
            kortet samt kontaktkopior i kopplade bokningar ersätts. Åtgärden kan
            inte ångras här. Bokningarnas tider, priser, status och kopplingar
            bevaras.
          </p>
          <p>
            Fristående bokningar, nedladdade exporter, kampanjrubriker, loggar
            och backups ändras inte. Kvarvarande historik är inte fullständigt
            anonym.
          </p>
          <button type="button" disabled={pending} onClick={prepareRemoval}>
            Förhandsgranska kontaktborttagning
          </button>
          {preview && (
            <div className="contact-removal-preview">
              <h3>Kontrollera omfattningen</h3>
              <p>
                Ett kundkort och {preview.linkedBookings} direktkopplade
                bokningar. Inga andra kunder ändras.
              </p>
              {preview.activeVisits > 0 && (
                <p role="alert">
                  Hantera {preview.activeVisits} kommande eller pågående
                  bokningar först. Öppna dem under Besök.
                </p>
              )}
              {preview.canRemove && (
                <form onSubmit={remove}>
                  <label className="archive-choice">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      required
                      disabled={pending}
                    />{" "}
                    Jag förstår omfattningen och vill ta bort
                    kontaktuppgifterna.
                  </label>
                  <button className="danger" disabled={pending || !confirmed}>
                    {pending ? "Tar bort…" : "Bekräfta kontaktborttagning"}
                  </button>
                </form>
              )}
            </div>
          )}
        </details>
      )}
      {message && (
        <p role="alert">
          {message} Vid ändrat underlag: läs in sidan och förhandsgranska igen.
        </p>
      )}
    </section>
  );
}
