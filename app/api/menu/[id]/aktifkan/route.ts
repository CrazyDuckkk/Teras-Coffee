import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { reactivateMenu } from "@/lib/queries/menu";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id } = await params;
  const row = await reactivateMenu(id);
  if (!row) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}
