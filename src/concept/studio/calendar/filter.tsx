"use client";

import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import type { Resource } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { Button } from "@/concept/ui/button";
import { SegmentedControl } from "@/concept/ui/controls";
import { Popover } from "@/concept/ui/popover";

interface FilterProps {
  rooms: Resource[];
  roomId: string | undefined;
  onRoom: (id: string | undefined) => void;
  onToday: () => void;
  atToday: boolean;
  children?: ReactNode;
}

/** Secondary calendar controls: a panel that grows from the button, or the bottom sheet on a phone. */
export function CalendarOverflow({ rooms, roomId, onRoom, onToday, atToday, children }: FilterProps) {
  return (
    <Popover title={t("calendar.options")} helpId="calendar.options" sheetOnPhone variant="secondary" icon={<Ellipsis size={20} aria-hidden />}>
      <div className="space-y-4 sm:w-80">
        <Button variant="secondary" size="sm" disabled={atToday} data-popover-close onClick={onToday}>{t("date.today")}</Button>
        {children}
        {rooms.length > 0 && (
          <div className="space-y-2">
            <p className="text-body font-medium">{t("calendar.rooms")}</p>
            <SegmentedControl label={t("calendar.rooms")} value={roomId ?? ""} onChange={id => onRoom(id || undefined)}
              options={[{ value: "", label: t("calendar.allRooms") }, ...rooms.map(room => ({ value: room.id, label: room.name }))]} />
          </div>
        )}
      </div>
    </Popover>
  );
}
