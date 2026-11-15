import { notFound } from "next/navigation";
import { isPublicReadonly } from "@/lib/public-readonly";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isPublicReadonly()) notFound();
  return children;
}
