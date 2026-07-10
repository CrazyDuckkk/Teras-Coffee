import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { createTutupKasir, SudahTutupKasirError } from "@/lib/queries/tutup-kasir";

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  try {
    const row = await createTutupKasir();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof SudahTutupKasirError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menutup kasir" }, { status: 500 });
  }
}
