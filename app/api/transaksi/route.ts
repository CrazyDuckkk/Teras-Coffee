import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { transaksiCreateSchema } from "@/lib/validations/transaksi";
import { createTransaksi, listTransaksiHariIni, MenuTidakAktifError, StokTidakCukupError } from "@/lib/queries/transaksi";

export async function GET() {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const data = await listTransaksiHariIni();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  const body = await request.json();
  const parsed = transaksiCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await createTransaksi(parsed.data, access.session.user.id);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof StokTidakCukupError) {
      return NextResponse.json({ error: err.message, shortages: err.shortages }, { status: 400 });
    }
    if (err instanceof MenuTidakAktifError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
