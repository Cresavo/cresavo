import { notFound } from "next/navigation";
import { RingPreview } from "@/concept/studio/web-call/ring-preview";

// Local screenshot and review states only. Missing on the production demo.
export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RingPreview />;
}
