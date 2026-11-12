import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import { batalkanPembayaran, PembayaranSudahDibatalkanError } from "@/lib/queries/hutang";
import { batalPembayaranSchema } from "@/lib/validations/hutang";
import {
  getPeringatanEksporUntukTanggalCore,
  getTanggalDampakPembatalanHutangCore,
} from "@/lib/laporan-ekspor-core";

// Pembatalan pembayaran hanya untuk owner (spesifikasi v2, bagian 3.3).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pembayaranId: string }> },
) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id, pembayaranId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(pembayaranId).success) {
    return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = batalPembayaranSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const tanggalDampak = await getTanggalDampakPembatalanHutangCore(id, pembayaranId, db);
    const peringatanEkspor = await getPeringatanEksporUntukTanggalCore(tanggalDampak, db);
    const result = await batalkanPembayaran(id, pembayaranId, parsed.data.alasan, access.session.user.id);
    if (!result) return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: result, peringatanEkspor });
  } catch (err) {
    if (err instanceof PembayaranSudahDibatalkanError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal membatalkan pembayaran" }, { status: 500 });
  }
}
