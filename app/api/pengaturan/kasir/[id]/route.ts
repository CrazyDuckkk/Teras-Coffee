import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { setKasirAktif } from "@/lib/queries/kasir";
import { cashierStatusSchema } from "@/lib/validations/kasir";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
  }

  const parsed = cashierStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const { id } = await params;
  const data = await setKasirAktif(id, parsed.data.isActive);
  if (!data) return NextResponse.json({ error: "Akun kasir tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data });
}
