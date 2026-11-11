import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { getRiwayatHarga } from "@/lib/queries/inventaris";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { id } = await params;
  const data = await getRiwayatHarga(id);
  return NextResponse.json({ data });
}
