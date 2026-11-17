"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import type { Resource, Staff, StaffId } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { Button } from "@/concept/ui/button";
import { Chip } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";

interface FilterProps {
  /** Empty when the viewer is limited to their own calendar. */
  staff: Staff[];
  staffId: StaffId | "all";
  onStaff: (id: StaffId | "all") => void;
  rooms: Resource[];
  roomId: string | undefined;
  onRoom: (id: string | undefined) => void;
}

/** One compact filter button; the choices for staff and rooms open in a sheet. */
export function CalendarFilter({ staff, staffId, onStaff, rooms, roomId, onRoom }: FilterProps) {
  const [open, setOpen] = useState(false);
  const chosen = [staff.find((s) => s.id === staffId)?.firstName, rooms.find((r) => r.id === roomId)?.name].filter(Boolean);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<ListFilter size={16} />} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {chosen.length ? chosen.join(" · ") : t("calendar.filter")}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("calendar.filter")}>
        <div className="space-y-5 pb-1">
          {staff.length > 0 && (
            <div className="space-y-2" role="group" aria-label={t("calendar.staff")}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{t("calendar.staff")}</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={staffId === "all"} onClick={() => onStaff("all")}>{t("calendar.everyone")}</Chip>
                {staff.map((s) => (
                  <Chip key={s.id} active={staffId === s.id} onClick={() => onStaff(s.id)}>{s.firstName}</Chip>
                ))}
              </div>
            </div>
          )}
          {rooms.length > 0 && (
            <div className="space-y-2" role="group" aria-label={t("calendar.rooms")}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{t("calendar.rooms")}</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={!roomId} onClick={() => onRoom(undefined)}>{t("calendar.allRooms")}</Chip>
                {rooms.map((r) => (
                  <Chip key={r.id} active={roomId === r.id} onClick={() => onRoom(r.id)}>{r.name}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
