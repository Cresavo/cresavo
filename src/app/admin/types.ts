import type { Weekly, Exceptions } from "@/lib/schedule";
export type ServiceView = {
  id: string;
  name: string;
  duration: number;
  buffer: number;
  priceOre: number;
  active: boolean;
  version: number;
};
export type StaffView = {
  id: string;
  name: string;
  active: boolean;
  version: number;
  serviceIds: string[];
  weekly: Weekly;
  exceptions: Exceptions;
};
export type BookingView = {
  id: string;
  serviceId: string;
  staffId: string;
  serviceName: string;
  priceOre: number;
  duration: number;
  buffer: number;
  startsAt: string;
  endsAt: string;
  status: string;
  version: number;
  customerName?: string;
  customerEmail?: string;
  events: {
    action: string;
    createdAt: string | Date;
    previousStart?: string | Date | null;
    nextStart?: string | Date | null;
  }[];
};
