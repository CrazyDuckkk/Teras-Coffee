import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import { koreksiStockMasuk } from "@/lib/queries/inventaris";
import {
  StockMasukLegacyTidakDapatDikoreksiError,
  StockMasukSudahDibatalkanError,
  StokTidakCukupUntukKoreksiError,
} from "@/lib/inventaris-core";
import { koreksiStockMasukSchema } from "@/lib/validations/inventaris";
import {
  getPeringatanEksporUntukTanggalCore,
  getTanggalStockMasukCore,
} from "@/lib/laporan-ekspor-core";

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
  const parsed = koreksiStockMasukSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const tanggal = await getTanggalStockMasukCore(id, db);
    const peringatanEkspor = tanggal
      ? await getPeringatanEksporUntukTanggalCore([tanggal], db)
      : [];
    const row = await koreksiStockMasuk(id, parsed.data.alasan, access.session.user.id);
    if (!row) return NextResponse.json({ error: "Stock Masuk tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row, peringatanEkspor });
  } catch (error) {
    if (
      error instanceof StockMasukLegacyTidakDapatDikoreksiError ||
      error instanceof StockMasukSudahDibatalkanError ||
      error instanceof StokTidakCukupUntukKoreksiError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal mengoreksi Stock Masuk" }, { status: 500 });
  }
}
