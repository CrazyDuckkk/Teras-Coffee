import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import {
  BahanPenyesuaianTidakDitemukanError,
  HargaSusutTidakDiketahuiError,
  MenuPenyesuaianTidakDitemukanError,
  MenuTidakAdaBahanPenyesuaianError,
  NilaiPenyesuaianTerlaluBesarError,
  StokTidakCukupUntukPenyesuaianError,
} from "@/lib/inventaris-core";
import { catatPenyesuaianStok } from "@/lib/queries/inventaris";
import { penyesuaianStokCreateSchema } from "@/lib/validations/inventaris";
import { getPeringatanEksporUntukTanggalCore } from "@/lib/laporan-ekspor-core";

export async function POST(request: Request) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = penyesuaianStokCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const now = new Date();
    const peringatanEkspor = access.session.user.role === "owner"
      ? await getPeringatanEksporUntukTanggalCore([now], db)
      : [];
    const row = await catatPenyesuaianStok(parsed.data, access.session.user.id, now);
    return NextResponse.json({ data: { id: row.id, jenis: row.jenis }, peringatanEkspor }, { status: 201 });
  } catch (error) {
    if (error instanceof BahanPenyesuaianTidakDitemukanError || error instanceof MenuPenyesuaianTidakDitemukanError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error instanceof MenuTidakAdaBahanPenyesuaianError ||
      error instanceof HargaSusutTidakDiketahuiError ||
      error instanceof StokTidakCukupUntukPenyesuaianError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof NilaiPenyesuaianTerlaluBesarError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal mencatat penyesuaian stok" }, { status: 500 });
  }
}
