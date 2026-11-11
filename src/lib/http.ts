import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function failure(error: unknown) { if (error instanceof ZodError) return NextResponse.json({ error: "Kontrollera uppgifterna" }, { status: 400 }); if (error instanceof Error && /Ogiltigt|finns inte|inte tillgänglig|Slutdatum/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 }); console.error(error); return NextResponse.json({ error: "Ett fel inträffade" }, { status: 500 }); }
