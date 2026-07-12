import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { reactivateBahanBaku } from "@/lib/queries/inventaris";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const row = await reactivateBahanBaku(id);
  if (!row) return NextResponse.json({ error: "Bahan baku tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}
