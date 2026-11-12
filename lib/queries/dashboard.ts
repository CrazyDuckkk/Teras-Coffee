import { db } from "@/db";
import { requireRole } from "@/lib/auth-guard";
import { getDashboardSummaryCore } from "@/lib/dashboard-core";

export async function getDashboardSummary() {
  await requireRole("owner");
  return getDashboardSummaryCore(db);
}
