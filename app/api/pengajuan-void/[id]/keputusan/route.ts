import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { HutangSudahLunasError } from "@/lib/queries/hutang";
import {
  PengajuanVoidSudahDiprosesError,
  putuskanPengajuanVoid,
} from "@/lib/queries/transaksi";
import { keputusanVoidSchema } from "@/lib/validations/transaksi";

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
  const parsed = keputusanVoidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await putuskanPengajuanVoid(id, parsed.data.keputusan, access.session.user.id);
    if (!row) return NextResponse.json({ error: "Pengajuan void tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof PengajuanVoidSudahDiprosesError || err instanceof HutangSudahLunasError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memproses pengajuan void" }, { status: 500 });
  }
}
