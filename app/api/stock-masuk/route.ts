import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth-guard";
import { stockMasukCreateSchema } from "@/lib/validations/inventaris";
import { createStockMasuk, listStockMasuk } from "@/lib/queries/inventaris";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bahanBakuId = searchParams.get("bahanBakuId") ?? undefined;
  const data = await listStockMasuk(bahanBakuId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const body = await request.json();
  const parsed = stockMasukCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await createStockMasuk(parsed.data);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Bahan baku tidak ditemukan") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan stock masuk" }, { status: 500 });
  }
}
