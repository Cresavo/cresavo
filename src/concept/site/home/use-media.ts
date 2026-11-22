import { useSyncExternalStore } from "react";

/** Whether a media query matches, live. The server (and the first render) assumes `server`. */
export function useMedia(query: string, server: boolean) {
  return useSyncExternalStore(
    (change) => {
      const list = matchMedia(query);
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    () => matchMedia(query).matches,
    () => server,
  );
}
