import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { TransaksiSudahVoidError, voidTransaksi } from "@/lib/queries/transaksi";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  try {
    const row = await voidTransaksi(id);
    if (!row) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof TransaksiSudahVoidError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal void transaksi" }, { status: 500 });
  }
}
