import { endpoint } from "@/concept/pairing/http";
import { session, manageSession } from "@/concept/pairing/studio";

export const GET = endpoint(session, "credential");
export const POST = endpoint(manageSession);
