import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { listHutang, type StatusHutang } from "@/lib/queries/hutang";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const data = await listHutang(status === "belum_lunas" || status === "lunas" ? (status as StatusHutang) : undefined);
  return NextResponse.json({ data });
}
