import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { listHutang, type StatusHutang } from "@/lib/queries/hutang";

export async function GET(request: Request) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const data = await listHutang(status === "belum_lunas" || status === "lunas" ? (status as StatusHutang) : undefined);
  return NextResponse.json({ data });
}
