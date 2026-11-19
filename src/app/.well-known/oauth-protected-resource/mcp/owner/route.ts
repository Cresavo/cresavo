import { endpoint } from "@/concept/pairing/http";
import { protectedResource } from "@/concept/pairing/metadata";

export const GET = endpoint(protectedResource);
