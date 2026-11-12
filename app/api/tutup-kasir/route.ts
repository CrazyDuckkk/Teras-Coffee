import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import { createTutupKasir, SudahTutupKasirError } from "@/lib/queries/tutup-kasir";
import { tutupKasirSchema } from "@/lib/validations/tutup-kasir";

export async function POST(request: Request) {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
    }

    const parsed = tutupKasirSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
    }

    const row = await createTutupKasir(access.session.user.id, parsed.data);
    return NextResponse.json(
      { data: { id: row.id, tanggal: row.tanggal, statusPenutupan: row.statusPenutupan } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SudahTutupKasirError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menutup kasir" }, { status: 500 });
  }
}
