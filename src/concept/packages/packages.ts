import type { Booking, DateKey, DemoState, Service, ServicePackage } from "../data/types";
import { paidWithCards } from "../giftcards/cards";

// A package (punch card) is prepaid like a gift card: selling it is not
// revenue. Each visit that uses it is marked done and counts as revenue for
// that visit at the package price divided by its visits, so the figures show
// what the customer actually paid per visit.

/** The one offer in the demo: five visits for the price of four. */
export const PACKAGE_DEAL = { visits: 5, paidVisits: 4 } as const;

export const packagePrice = (service: Service) => service.price * PACKAGE_DEAL.paidVisits;

export const visitsLeft = (pkg: ServicePackage) => pkg.visits - pkg.usedBy.length;

/** The customer's package that the next visit of this treatment would use: oldest first. */
export function activePackage(state: DemoState, customerId: string, serviceId: string): ServicePackage | undefined {
  return state.packages.find((p) => p.customerId === customerId && p.serviceId === serviceId && visitsLeft(p) > 0);
}

/** The package a booking that is not done yet would use. */
/** An existing gift-card payment takes precedence over using a package visit. */
export const packageFor = (state: DemoState, booking: Booking) =>
  booking.status === "booked" && paidWithCards(state, booking.id) === 0
    ? activePackage(state, booking.customerId, booking.serviceId)
    : undefined;

/** What the unused visits are worth: money the business owes its customers. */
export function packageLiability(state: DemoState): number {
  return state.packages.reduce((sum, p) => sum + Math.round((p.price * visitsLeft(p)) / p.visits), 0);
}

export function sellPackage(state: DemoState, input: { customerId: string; serviceId: string; date: DateKey }): DemoState {
  const service = state.services.find((s) => s.id === input.serviceId);
  if (!service || !state.customers.some((c) => c.id === input.customerId)) return state;
  const pkg: ServicePackage = {
    id: `pk-${state.seq}`,
    customerId: input.customerId,
    serviceId: service.id,
    visits: PACKAGE_DEAL.visits,
    price: packagePrice(service),
    soldOn: input.date,
    usedBy: [],
  };
  return { ...state, seq: state.seq + 1, packages: [...state.packages, pkg] };
}

/** Uses one visit of the customer's package for a booking being marked done, if there is one. The visit then earns its share of the package price. */
export function consumePackageVisit(state: DemoState, booking: Booking): DemoState {
  const pkg = packageFor(state, booking);
  if (!pkg) return state;
  return {
    ...state,
    packages: state.packages.map((p) => (p.id === pkg.id ? { ...p, usedBy: [...p.usedBy, booking.id] } : p)),
    bookings: state.bookings.map((b) => (b.id === booking.id ? { ...b, price: Math.round(pkg.price / pkg.visits) } : b)),
  };
}
