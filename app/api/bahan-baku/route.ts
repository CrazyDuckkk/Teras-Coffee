import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { bahanBakuCreateSchema } from "@/lib/validations/inventaris";
import { createBahanBaku, listBahanBaku } from "@/lib/queries/inventaris";

export async function GET(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const data = await listBahanBaku(includeInactive);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const body = await request.json();
  const parsed = bahanBakuCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await createBahanBaku(parsed.data);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("bahan_baku_nama_lower_idx")) {
      return NextResponse.json({ error: "Nama bahan sudah dipakai" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat bahan baku" }, { status: 500 });
  }
}
