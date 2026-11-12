import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import {
  getPeringatanEksporUntukTanggalCore,
  getTanggalDampakVoidCore,
} from "@/lib/laporan-ekspor-core";
import {
  PengajuanVoidSedangMenungguError,
  TransaksiSudahVoidError,
  voidTransaksi,
} from "@/lib/queries/transaksi";
import { HutangSudahLunasError } from "@/lib/queries/hutang";
import { voidReasonSchema } from "@/lib/validations/transaksi";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = voidReasonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const tanggalDampak = await getTanggalDampakVoidCore(id, db);
    const peringatanEkspor = await getPeringatanEksporUntukTanggalCore(tanggalDampak, db);
    const row = await voidTransaksi(id, parsed.data.alasan, access.session.user.id);
    if (!row) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row, peringatanEkspor });
  } catch (err) {
    if (
      err instanceof TransaksiSudahVoidError ||
      err instanceof PengajuanVoidSedangMenungguError ||
      err instanceof HutangSudahLunasError
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal void transaksi" }, { status: 500 });
  }
}
