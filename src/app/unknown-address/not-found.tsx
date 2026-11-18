import { headers } from "next/headers";
import { UnknownAddress } from "@/concept/booking/unknown-address";

export default async function NotFound() {
  const host = (await headers()).get("x-concept-address");
  return <UnknownAddress host={host?.slice(0, 100)} />;
}
