"use client";

import { Bone, SkeletonColumn, SkeletonGroup, SkeletonRow } from "../ui/feedback";

/**
 * A page while it loads: the title row and the surface it will fill, as quiet blocks in the same places. The first
 * load draws it inside the studio's chrome; a tab switch draws it in place of the page, so the move is immediate.
 */
export function PageSilhouette({ calendar = false }: { calendar?: boolean }) {
  return (
    <>
      <div aria-hidden className="space-y-3 pb-6 pt-4">
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-64 max-w-full" />
      </div>
      {calendar ? (
        <div aria-hidden className="flex gap-4">
          <SkeletonColumn />
          <SkeletonColumn className="max-sm:hidden" />
          <SkeletonColumn className="max-lg:hidden" />
        </div>
      ) : (
        <div aria-hidden className="rounded-lg bg-surface md:max-w-3xl">
          {Array.from({ length: 5 }, (_, row) => <SkeletonRow key={row} />)}
        </div>
      )}
    </>
  );
}

/** The route's loading boundary: the silhouette, announced once as loading. */
export function StudioPageLoading({ calendar = false }: { calendar?: boolean }) {
  return <SkeletonGroup><PageSilhouette calendar={calendar} /></SkeletonGroup>;
}
