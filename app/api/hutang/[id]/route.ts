import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { getHutangDetail } from "@/lib/queries/hutang";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const { id } = await params;
  const row = await getHutangDetail(id);
  if (!row) return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}
