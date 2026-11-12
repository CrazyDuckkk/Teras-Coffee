import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import {
  catatPembayaran,
  HutangSudahLunasError,
  HutangTidakAktifError,
  PembayaranMelebihiSisaError,
} from "@/lib/queries/hutang";
import { pembayaranHutangSchema } from "@/lib/validations/hutang";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = pembayaranHutangSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const result = await catatPembayaran(id, parsed.data, access.session.user.id);
    if (!result) return NextResponse.json({ error: "Hutang tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    if (
      err instanceof HutangSudahLunasError ||
      err instanceof HutangTidakAktifError ||
      err instanceof PembayaranMelebihiSisaError
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan pembayaran hutang" }, { status: 500 });
  }
}
