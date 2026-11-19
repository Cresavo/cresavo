import { endpoint } from "@/concept/pairing/http";
import { authorize, consent } from "@/concept/pairing/authorize";

export const GET = endpoint(authorize);
export const POST = endpoint(consent);
