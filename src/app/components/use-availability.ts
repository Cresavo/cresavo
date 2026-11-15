"use client";
import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";

async function fetchDay(
  endpoint: string,
  serviceId: string,
  staffId: string,
  day: string,
  signal: AbortSignal,
) {
  let response, result;
  try {
    response = await fetch(
      `${endpoint}?${new URLSearchParams({ serviceId, staffId, date: day })}`,
      { cache: "no-store", signal },
    );
    result = await response.json();
  } catch {
    throw new Error("Tiderna kunde inte hämtas. Försök igen.");
  }
  if (!response.ok)
    throw Error(result.error ?? "Tiderna kunde inte hämtas. Försök igen.");
  return result as string[];
}

// Presentation only. Availability and all booking rules remain on the server.
export function useAvailability(
  serviceId: string,
  staffId: string,
  date: string,
  endpoint = "/api/availability",
) {
  const key = JSON.stringify([serviceId, staffId, date, endpoint]);
  const [revision, setRevision] = useState(0),
    [read, setRead] = useState<{
      key: string;
      slots: string[];
      error: string;
    } | null>(null);
  const [finding, setFinding] = useState(false);
  const nextAbort = useRef<AbortController | null>(null);
  const valid = !!serviceId && !!staffId && /^\d{4}-\d{2}-\d{2}$/.test(date);
  useEffect(() => {
    const controller = new AbortController();
    if (valid)
      void fetchDay(endpoint, serviceId, staffId, date, controller.signal)
        .then((slots) => {
          if (!controller.signal.aborted) setRead({ key, slots, error: "" });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setRead({
              key,
              slots: [],
              error:
                error instanceof Error
                  ? error.message
                  : "Tiderna kunde inte hämtas.",
            });
        });
    return () => {
      controller.abort();
      nextAbort.current?.abort();
    };
  }, [key, revision, valid, endpoint, serviceId, staffId, date]);
  const current = read?.key === key ? read : null;
  return {
    slots: current?.slots ?? [],
    error: current?.error ?? "",
    loading: valid && !current,
    finding,
    refresh: () => {
      setRead(null);
      setRevision((r) => r + 1);
    },
    next: async (choose: (value: string) => void) => {
      nextAbort.current?.abort();
      const controller = new AbortController();
      nextAbort.current = controller;
      setFinding(true);
      const today = DateTime.now().setZone("Europe/Stockholm").startOf("day"),
        last = today.plus({ days: 60 });
      let day = DateTime.fromISO(date, { zone: "Europe/Stockholm" })
        .startOf("day")
        .plus({ days: 1 });
      if (!day.isValid || day < today) day = today;
      try {
        for (; day <= last; day = day.plus({ days: 1 })) {
          const value = day.toISODate()!;
          const slots = await fetchDay(
            endpoint,
            serviceId,
            staffId,
            value,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (slots.length) {
            choose(value);
            return;
          }
        }
        setRead({
          key,
          slots: [],
          error:
            "Inga lediga tider inom de närmaste 60 dagarna. Välj en annan behandling eller medarbetare.",
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setRead({
            key,
            slots: [],
            error:
              error instanceof Error
                ? error.message
                : "Tiderna kunde inte hämtas.",
          });
      } finally {
        if (nextAbort.current === controller) setFinding(false);
      }
    },
  };
}
