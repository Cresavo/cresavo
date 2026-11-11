import { NextRequest, NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/auth";
import { publishCampaign } from "@/lib/domain";
import { failure } from "@/lib/http";
export async function POST(r: NextRequest) { if (!await sameOrigin() || !await isAdmin())
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 }); try {
    const v = await r.json();
    if (!v || typeof v.id !== "string" || v.id.length > 100)
        return NextResponse.json({ error: "Ogiltigt id" }, { status: 400 });
    await publishCampaign(v.id);
    return NextResponse.json({ ok: true });
}
catch (e) {
    return failure(e);
} }
