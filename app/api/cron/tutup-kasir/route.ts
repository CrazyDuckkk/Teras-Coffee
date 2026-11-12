import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { tutupKasirOtomatisJikaTiba } from "@/lib/queries/tutup-kasir";

export const runtime = "nodejs";

function isAuthorized(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const receivedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET belum dikonfigurasi untuk tutup kasir otomatis.");
    return NextResponse.json({ error: "Konfigurasi penjadwal belum lengkap" }, { status: 500 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const result = await tutupKasirOtomatisJikaTiba();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Gagal menjalankan tutup kasir otomatis:", error);
    return NextResponse.json({ error: "Gagal menjalankan tutup kasir otomatis" }, { status: 500 });
  }
}
