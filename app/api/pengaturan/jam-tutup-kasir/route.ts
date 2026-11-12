import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth-guard";
import {
  getPengaturanJamTutupKasir,
  ubahJamTutupKasir,
} from "@/lib/queries/tutup-kasir";
import { jamTutupKasirSchema } from "@/lib/validations/tutup-kasir";

export async function GET() {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  try {
    return NextResponse.json({ data: await getPengaturanJamTutupKasir() });
  } catch (error) {
    console.error("Gagal membaca pengaturan jam tutup kasir:", error);
    return NextResponse.json({ error: "Gagal membaca pengaturan jam tutup kasir" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid" }, { status: 400 });
  }

  const parsed = jamTutupKasirSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const data = await ubahJamTutupKasir(parsed.data.jam, access.session.user.id);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("Gagal mengubah pengaturan jam tutup kasir:", error);
    return NextResponse.json({ error: "Gagal mengubah pengaturan jam tutup kasir" }, { status: 500 });
  }
}
