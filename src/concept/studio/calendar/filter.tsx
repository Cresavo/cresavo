"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import type { Resource } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { Button } from "@/concept/ui/button";
import { Chip } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";

interface FilterProps {
  rooms: Resource[];
  roomId: string | undefined;
  onRoom: (id: string | undefined) => void;
}

/** The room filter: one compact button, the choices in a sheet. Staff are chosen right on the page. */
export function CalendarFilter({ rooms, roomId, onRoom }: FilterProps) {
  const [open, setOpen] = useState(false);
  const chosen = rooms.find((r) => r.id === roomId)?.name;
  return (
    <>
      <Button variant="secondary" size="sm" icon={<ListFilter size={16} />} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {chosen ?? t("calendar.rooms")}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("calendar.rooms")}>
        <div className="space-y-5 pb-1">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("calendar.rooms")}>
            <Chip active={!roomId} onClick={() => onRoom(undefined)}>{t("calendar.allRooms")}</Chip>
            {rooms.map((r) => (
              <Chip key={r.id} active={roomId === r.id} onClick={() => onRoom(r.id)}>{r.name}</Chip>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
