import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { TransaksiSudahVoidError, voidTransaksi } from "@/lib/queries/transaksi";
import { HutangSudahLunasError } from "@/lib/queries/hutang";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id } = await params;
  try {
    const row = await voidTransaksi(id);
    if (!row) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof TransaksiSudahVoidError || err instanceof HutangSudahLunasError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal void transaksi" }, { status: 500 });
  }
}
