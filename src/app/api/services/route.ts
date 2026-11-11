import { NextResponse } from "next/server";
import { listServices } from "@/lib/domain"; import { failure } from "@/lib/http";
export async function GET() { try { return NextResponse.json(await listServices()); } catch(e) { return failure(e); } }
