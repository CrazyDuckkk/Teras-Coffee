import { PageHeader } from "@/components/layout/page-header";
import { listHutang } from "@/lib/queries/hutang";
import { HutangList } from "@/components/hutang/hutang-list";

export default async function HutangPage() {
  const data = await listHutang();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Hutang" description="Piutang pelanggan dari transaksi metode Hutang" />
      <HutangList data={data} />
    </div>
  );
}
