import { isPublicDemo } from "../connections/server/config";
import { resolveHost } from "../page/resolve";

export function galleryAvailable(host: string | null | undefined) {
  if (process.env.NODE_ENV !== "development" || isPublicDemo(process.env)) return false;
  const route = resolveHost(host);
  return route.kind === "app";
}
