import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { setLocaleCookie } from "@/lib/locale-cookie";
import { parseLocale } from "@/lib/locale";

export async function POST(request: Request) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const input: unknown = await request.json();
    const locale =
      input && typeof input === "object" && "locale" in input
        ? parseLocale(input.locale)
        : null;
    if (!locale)
      return NextResponse.json({ error: "Ogiltigt språk" }, { status: 400 });
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    setLocaleCookie(response, locale);
    return response;
  } catch {
    return NextResponse.json({ error: "Ogiltigt språk" }, { status: 400 });
  }
}
