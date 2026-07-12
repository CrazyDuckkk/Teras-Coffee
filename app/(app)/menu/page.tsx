import { PageHeader } from "@/components/layout/page-header";
import { listMenu } from "@/lib/queries/menu";
import { listBahanBaku } from "@/lib/queries/inventaris";
import { MenuActions } from "@/components/menu/menu-actions";
import { MenuGrid } from "@/components/menu/menu-grid";

export default async function MenuPage() {
  const [menuList, bahanBakuList] = await Promise.all([listMenu(true), listBahanBaku(false)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Menu"
        description="Kelola menu, resep, HPP, dan keuntungan otomatis"
        actions={<MenuActions bahanBaku={bahanBakuList} />}
      />
      <MenuGrid data={menuList} bahanBaku={bahanBakuList} />
    </div>
  );
}
