import { PageHeader } from "@/components/layout/page-header";
import { listBahanBaku } from "@/lib/queries/inventaris";
import { InventarisActions } from "@/components/inventaris/inventaris-actions";
import { BahanBakuTable } from "@/components/inventaris/bahan-baku-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

export default async function InventarisPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role === "cashier") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stok Bahan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Fitur Stok Bahan untuk kasir sedang disiapkan.
        </CardContent>
      </Card>
    );
  }
  await requireRole("owner");

  const bahanBaku = await listBahanBaku(true);
  const bahanBakuAktif = bahanBaku.filter((b) => b.isActive);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventaris"
        description="Kelola bahan baku, stock masuk, dan riwayat harga"
        actions={<InventarisActions bahanBaku={bahanBakuAktif} />}
      />
      <BahanBakuTable data={bahanBaku} />
    </div>
  );
}
