import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { putuskanHargaStockMasuk } from "@/lib/queries/inventaris";
import { StockMasukSudahDiprosesError, StockMasukSudahDibatalkanError } from "@/lib/inventaris-core";
import { keputusanHargaStockMasukSchema } from "@/lib/validations/inventaris";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Stock Masuk tidak ditemukan" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = keputusanHargaStockMasukSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await putuskanHargaStockMasuk(id, parsed.data.keputusan, access.session.user.id);
    if (!row) return NextResponse.json({ error: "Stock Masuk tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (error) {
    if (error instanceof StockMasukSudahDiprosesError || error instanceof StockMasukSudahDibatalkanError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal memproses konfirmasi harga" }, { status: 500 });
  }
}
