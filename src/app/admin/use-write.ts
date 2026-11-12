"use client";
import { useEffect, useRef, useState } from "react";

export function useWrite() {
  const request = useRef<{ payload: string; key: string } | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState<number | null>(null);
  async function write<T>(url: string, input: unknown): Promise<T | null> {
    if (busy.current) return null;
    const payload = JSON.stringify({ url, input });
    if (request.current?.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setMessage("");
    setStatus(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.current.key,
        },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(
          typeof data.error === "string"
            ? data.error
            : "Ändringen kunde inte sparas.",
        );
        setStatus(response.status);
        return null;
      }
      return data as T;
    } catch {
      setMessage("Svaret kunde inte hämtas. Försök igen med samma uppgifter.");
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { write, pending, message, status };
}

export function useUnsavedChanges() {
  const dirty = useRef(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = true;
      }
    };
    window.addEventListener("beforeunload", warn);
    const navigation = (event: MouseEvent) => {
      if (
        !dirty.current ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const url = new URL(link.href);
      if (
        url.pathname === location.pathname &&
        url.search === location.search &&
        url.hash
      )
        return;
      if (window.confirm("Lämna sidan utan att spara ändringarna?")) {
        dirty.current = false;
      } else {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigation, true);
    };
  }, []);
  return {
    markDirty: () => {
      dirty.current = true;
    },
    markClean: () => {
      dirty.current = false;
    },
  };
}
