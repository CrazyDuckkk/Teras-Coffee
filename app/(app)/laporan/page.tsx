import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";

export default async function LaporanPage() {
  await requireRole("owner");
  redirect("/keuangan?tab=laporan");
}
