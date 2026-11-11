import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { createKasir, EmailKasirSudahDipakaiError, listKasir } from "@/lib/queries/kasir";
import { cashierCreateSchema } from "@/lib/validations/kasir";

export async function GET() {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  const data = await listKasir();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
  }

  const parsed = cashierCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const data = await createKasir(parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailKasirSudahDipakaiError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Gagal membuat akun kasir:", error);
    return NextResponse.json({ error: "Gagal membuat akun kasir" }, { status: 500 });
  }
}
