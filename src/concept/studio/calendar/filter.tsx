"use client";

import { useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import type { Resource } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { Button, IconButton } from "@/concept/ui/button";
import { SegmentedControl } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";

interface FilterProps {
  rooms: Resource[];
  roomId: string | undefined;
  onRoom: (id: string | undefined) => void;
  onToday: () => void;
  atToday: boolean;
  children?: ReactNode;
}

export function CalendarOverflow({ rooms, roomId, onRoom, onToday, atToday, children }: FilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={t("calendar.options")} variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Ellipsis size={20} aria-hidden />
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("calendar.options")}>
        <div className="space-y-4">
          <Button variant="secondary" size="sm" disabled={atToday} onClick={() => { onToday(); setOpen(false); }}>{t("date.today")}</Button>
          {children}
          {rooms.length > 0 && (
            <div className="space-y-2">
              <p className="text-body font-medium">{t("calendar.rooms")}</p>
              <SegmentedControl label={t("calendar.rooms")} value={roomId ?? ""} onChange={id => onRoom(id || undefined)}
                options={[{ value: "", label: t("calendar.allRooms") }, ...rooms.map(room => ({ value: room.id, label: room.name }))]} />
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
