// One synthetic venue and one existing Staff-owned weekly/exception schedule.
// These are resolved by the server, never by a booking payload or display label.
export const DEMO_LOCATION_ID = "demo-location";
export function placeForStaff(staffId: string) {
  return { locationId: DEMO_LOCATION_ID, scheduleId: `staff-schedule:${staffId}` };
}
