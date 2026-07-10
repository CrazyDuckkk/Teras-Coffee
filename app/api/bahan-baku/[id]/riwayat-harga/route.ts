import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { getRiwayatHarga } from "@/lib/queries/inventaris";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const data = await getRiwayatHarga(id);
  return NextResponse.json({ data });
}
