"use client";

import { useParams } from "next/navigation";
import { CampaignDetail } from "@/concept/studio/campaigns/campaign-detail";

export default function CampaignPage() {
  const id = useParams<{ id: string }>()?.id ?? "";
  return <CampaignDetail id={id} />;
}
