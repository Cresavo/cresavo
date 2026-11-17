import { isPublicReadonly } from "@/lib/public-readonly";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { liveSnapshot, type LiveSnapshot } from "@/lib/agent-api/live";
import { getLocale } from "@/lib/locale-server";
import { LiveBoard } from "./board";
import "./live-global.css";

export const metadata: Metadata = {
  title: "Flerdo — live agent sandbox",
  description: "Agents booking against the Flerdo engine in real time. Synthetic data only.",
};

export default async function LivePage() {
  if (isPublicReadonly()) notFound();
  const locale = await getLocale();
  let initial: LiveSnapshot | null = null;
  try {
    initial = await liveSnapshot();
  } catch {
    console.error("AGENT_LIVE_FAILED");
  }
  return <LiveBoard initial={initial} locale={locale} />;
}
