import { z } from "zod";
import { db } from "@/db";
import { requireApiRole } from "@/lib/auth-guard";
import {
  buatWorkbookLaporan,
  labelRentangEkspor,
  simpanEksporLaporanCore,
} from "@/lib/laporan-ekspor-core";
import { buatRentangLaporan } from "@/lib/laporan-keuangan-core";
import { getLaporanKeuanganCore } from "@/lib/laporan-keuangan-core";

export const runtime = "nodejs";

const eksporSchema = z.object({
  periode: z.enum(["mingguan", "bulanan"]),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const access = await requireApiRole("owner");
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = eksporSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const range = buatRentangLaporan(parsed.data.periode, parsed.data.tanggal);
  if (range.tanggalAcuan !== parsed.data.tanggal) {
    return Response.json({ error: "Tanggal periode tidak valid" }, { status: 400 });
  }

  try {
    const data = await getLaporanKeuanganCore(range, db);
    const dibuatPada = new Date();
    const workbook = buatWorkbookLaporan(data, dibuatPada);
    const buffer = new Uint8Array(await workbook.xlsx.writeBuffer());
    const namaFile = `Laporan_Teras_Coffee_${labelRentangEkspor(range)}.xlsx`;

    await simpanEksporLaporanCore({
      periode: range.periode,
      rentangMulai: range.start,
      rentangSampai: range.end,
      namaFile,
      dieksporOleh: access.session.user.id,
      dieksporPada: dibuatPada,
    }, db);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${namaFile}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Gagal membuat ekspor laporan" }, { status: 500 });
  }
}
