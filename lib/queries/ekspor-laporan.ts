import { db } from "@/db";
import { requireRole } from "@/lib/auth-guard";
import { listEksporLaporanCore } from "@/lib/laporan-ekspor-core";

export async function listRiwayatEksporLaporan() {
  await requireRole("owner");
  return listEksporLaporanCore(db);
}
