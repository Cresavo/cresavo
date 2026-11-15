export type ProviderService = {
  id: string; name: string; duration: number; buffer: number; priceOre: number; version: number;
};
export type ProviderResource = { id: string; name: string; serviceIds: string[] };
export type BookingInput = {
  serviceId: string; serviceVersion?: number; staffId?: string; start: string;
  customerName: string; customerEmail: string;
};
export type ProviderBooking = {
  id: string; status: string; startsAt: Date; endsAt: Date; duration: number;
  serviceId: string; serviceName: string; staffId: string; version: number; createdAt: Date;
};

export interface BookingProvider {
  readonly id: string;
  readonly capabilities: Readonly<{
    holdSlot: boolean; cancelBooking: boolean; staffSelection: boolean;
    idempotency: boolean; timeZone: string;
  }>;
  listServices(): Promise<{ services: ProviderService[]; resources: ProviderResource[] }>;
  getAvailability(serviceId: string, day: string, resourceId?: string): Promise<{ starts: string[]; timeZone: string }>;
  holdSlot(input: { serviceId: string; start: string; resourceId?: string }): Promise<{ id: string }>;
  createBooking(input: BookingInput, idempotencyKey: string, channel: string): Promise<ProviderBooking>;
  getBooking(id: string): Promise<ProviderBooking>;
  cancelBooking(id: string, actorId: string): Promise<{ row: ProviderBooking; already: boolean }>;
}
export class ProviderUnsupportedError extends Error {
  readonly code = "provider_operation_unsupported";
  constructor(readonly providerId: string, readonly operation: string) {
    super("Booking provider operation is not supported.");
    this.name = "ProviderUnsupportedError";
  }
}
