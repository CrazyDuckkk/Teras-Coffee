import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import {
  BahanPenyesuaianTidakDitemukanError,
  HargaSusutTidakDiketahuiError,
  NilaiPenyesuaianTerlaluBesarError,
  OpnameTanpaSelisihError,
} from "@/lib/inventaris-core";
import { catatOpnameStok } from "@/lib/queries/inventaris";
import { opnameStokSchema } from "@/lib/validations/inventaris";
import { getPeringatanEksporUntukTanggalCore } from "@/lib/laporan-ekspor-core";

export async function POST(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = opnameStokSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const now = new Date();
    const peringatanEkspor = await getPeringatanEksporUntukTanggalCore([now], db);
    const row = await catatOpnameStok(parsed.data, access.session.user.id, now);
    return NextResponse.json({ data: { id: row.id, jenis: row.jenis }, peringatanEkspor }, { status: 201 });
  } catch (error) {
    if (error instanceof BahanPenyesuaianTidakDitemukanError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OpnameTanpaSelisihError || error instanceof HargaSusutTidakDiketahuiError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof NilaiPenyesuaianTerlaluBesarError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Gagal mencatat hasil opname" }, { status: 500 });
  }
}
