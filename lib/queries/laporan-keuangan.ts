import { db } from "@/db";
import { requireRole } from "@/lib/auth-guard";
import {
  getLaporanKeuanganCore,
  type RentangLaporan,
} from "@/lib/laporan-keuangan-core";

export async function getLaporanKeuangan(range: RentangLaporan) {
  await requireRole("owner");
  return getLaporanKeuanganCore(range, db);
}
