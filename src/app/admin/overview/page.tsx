import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";
import { capacityListSchema, listCapacity } from "@/lib/capacity";
import { DomainError, pageDataFailure } from "@/lib/errors";
import AdminHeader from "../header";
import CapacityOverview from "./overview";
import ContextLink from "../../components/context-link";
export const dynamic = "force-dynamic";
export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin");
  const params = await searchParams;
  const parsed = capacityListSchema.safeParse({
    ...params,
    ...(params.days !== undefined && { days: Number(params.days) }),
    ...(params.limit !== undefined && { limit: Number(params.limit) }),
  });
  const initialQuery = parsed.success
    ? parsed.data
    : capacityListSchema.parse({});
  const actor = { kind: "admin" as const, id: admin.id };
  const { result, query, invalid } = await listCapacity(initialQuery, actor)
    .then((result) => ({
      result,
      query: initialQuery,
      invalid: !parsed.success,
    }))
    .catch(async (error) => {
      if (
        error instanceof DomainError &&
        (error.status === 400 || error.status === 409)
      ) {
        const fallback = capacityListSchema.parse({});
        return {
          result: await listCapacity(fallback, actor).catch(pageDataFailure),
          query: fallback,
          invalid: true,
        };
      }
      return pageDataFailure(error);
    });
  return (
    <>
      <AdminHeader email={admin.email} active="overview" />
      <main className="admin-workspace narrow-workspace">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">Salongens arbetsdag</p>
            <h1>Översikt</h1>
          </div>
          <ContextLink className="button-link" href="/admin">
            Öppna kalendern
          </ContextLink>
        </div>
        <p>
          Se vad som behöver ett beslut. Förslagen bygger på verkliga
          avbokningar och aktuella scheman.
        </p>
        {invalid && <p role="alert">Ogiltigt sidval. Visar första sidan.</p>}
        <CapacityOverview
          key={JSON.stringify(query)}
          initial={result}
          query={query}
        />
      </main>
    </>
  );
}
