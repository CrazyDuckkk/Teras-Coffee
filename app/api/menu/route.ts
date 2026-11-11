import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { menuInputSchema } from "@/lib/validations/menu";
import { createMenu, listMenu } from "@/lib/queries/menu";

export async function GET(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const data = await listMenu(includeInactive);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const body = await request.json();
  const parsed = menuInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await createMenu(parsed.data);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat menu" }, { status: 500 });
  }
}
