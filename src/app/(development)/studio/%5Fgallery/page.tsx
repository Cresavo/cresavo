import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { galleryAvailable } from "@/concept/server/gallery";
import { siteRequestHost } from "@/concept/site/request-host";
import { StudioLanguage } from "@/concept/studio/studio-language";
import { Gallery } from "./gallery";
import "@/app/studio/studio.css";

export default async function GalleryPage() {
  const requestHeaders = await headers();
  if (!galleryAvailable(siteRequestHost(name => requestHeaders.get(name)))) notFound();
  return <StudioLanguage><main className="studio-root"><Gallery /></main></StudioLanguage>;
}
