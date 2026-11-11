import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { HutangSudahLunasError, tandaiLunas } from "@/lib/queries/hutang";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const { id } = await params;
  try {
    const row = await tandaiLunas(id);
    if (!row) return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof HutangSudahLunasError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menandai hutang lunas" }, { status: 500 });
  }
}
