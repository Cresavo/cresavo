// Whether a booking or log id is confirmed by the server. Only the browser store
// can have provisional ids (a signed-in salon's change still waiting for its
// answer), so it registers the real check. Code that also runs on the server,
// such as the assistant's proposals behind MCP, asks here instead of importing
// the client-only store; with nothing registered every id is settled.

export type RecordCollection = "bookings" | "log" | "journals";
type Check = (collection: RecordCollection, id: string) => boolean;

let check: Check = () => true;

export const recordSettled: Check = (collection, id) => check(collection, id);

export function registerRecordSettledCheck(next: Check) {
  check = next;
}
