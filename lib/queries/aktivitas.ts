import { db } from "@/db";
import { requireRole } from "@/lib/auth-guard";
import { listAktivitasCore } from "@/lib/aktivitas-core";

export async function listAktivitasTerbaru(limit = 40) {
  await requireRole("owner");
  return listAktivitasCore(db, limit);
}
