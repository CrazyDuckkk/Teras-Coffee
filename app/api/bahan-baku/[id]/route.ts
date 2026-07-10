import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth-guard";
import { bahanBakuUpdateSchema } from "@/lib/validations/inventaris";
import { BahanMasihDipakaiError, deactivateBahanBaku, getBahanBakuById, updateBahanBaku } from "@/lib/queries/inventaris";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const row = await getBahanBakuById(id);
  if (!row) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = bahanBakuUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await updateBahanBaku(id, parsed.data);
    if (!row) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof Error && err.message.includes("bahan_baku_nama_lower_idx")) {
      return NextResponse.json({ error: "Nama bahan sudah dipakai" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui bahan baku" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  try {
    const row = await deactivateBahanBaku(id);
    if (!row) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof BahanMasihDipakaiError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menonaktifkan bahan baku" }, { status: 500 });
  }
}
