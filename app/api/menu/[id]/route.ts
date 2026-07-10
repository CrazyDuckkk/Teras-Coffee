import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth-guard";
import { menuInputSchema } from "@/lib/validations/menu";
import { deactivateMenu, getMenuWithResep, updateMenu } from "@/lib/queries/menu";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const row = await getMenuWithResep(id);
  if (!row) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = menuInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  try {
    const row = await updateMenu(id, parsed.data);
    if (!row) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memperbarui menu" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await params;
  const row = await deactivateMenu(id);
  if (!row) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: row });
}
