import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { stockMasukCreateSchema } from "@/lib/validations/inventaris";
import { createStockMasuk, listStockMasuk } from "@/lib/queries/inventaris";
import { BahanStockMasukTidakDitemukanError, HargaStockMasukTidakValidError } from "@/lib/inventaris-core";

export async function GET(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const bahanBakuId = searchParams.get("bahanBakuId") ?? undefined;
  const data = await listStockMasuk(bahanBakuId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = stockMasukCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await createStockMasuk(parsed.data, access.session.user.id);
    const data =
      access.session.user.role === "owner" ? row : { id: row.id, statusHarga: row.statusHarga };
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof BahanStockMasukTidakDitemukanError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof HargaStockMasukTidakValidError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan stock masuk" }, { status: 500 });
  }
}
