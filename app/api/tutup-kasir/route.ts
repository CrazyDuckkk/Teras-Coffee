import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { createTutupKasir, SudahTutupKasirError } from "@/lib/queries/tutup-kasir";

export async function POST() {
  const access = await requireApiRole("owner", "cashier");
  if (!access.ok) return access.response;

  try {
    const row = await createTutupKasir();
    return NextResponse.json(
      { data: { id: row.id, tanggal: row.tanggal } },
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
