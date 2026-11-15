import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
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
    response.cookies.set("booking-locale", locale, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Ogiltigt språk" }, { status: 400 });
  }
}
