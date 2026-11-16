// Customer-facing routes. The salon slug is fixed for the demo.

export const BOOKING_HOME = "/boka/salong-eko";
export const MY_BOOKINGS = `${BOOKING_HOME}/me`;

export const bookingPage = (id: string) => `${BOOKING_HOME}/booking/${id}`;
export const myBookingsFor = (customerId: string) => `${MY_BOOKINGS}?ref=${encodeURIComponent(customerId)}`;
export const rebookLink = (serviceId: string) => `${BOOKING_HOME}?service=${encodeURIComponent(serviceId)}#book`;
