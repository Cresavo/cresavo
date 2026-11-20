import { notFound } from "next/navigation";
import { isPublicReadonly } from "@/lib/public-readonly";
import { hostInstallMetadata } from "./served-path";

export const generateMetadata = hostInstallMetadata;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isPublicReadonly()) notFound();
  return children;
}
