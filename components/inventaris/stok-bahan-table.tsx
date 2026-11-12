import { StatusBadge, stokStatus } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { listStokBahan } from "@/lib/queries/inventaris";

type StokBahan = Awaited<ReturnType<typeof listStokBahan>>[number];

export function StokBahanTable({ data }: { data: StokBahan[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada bahan baku aktif.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-card shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Satuan</TableHead>
            <TableHead>Stok Saat Ini</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const { status, label } = stokStatus(Number(row.stokSaatIni), Number(row.batasMinimumStok));
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.nama}</TableCell>
                <TableCell>{row.satuan}</TableCell>
                <TableCell className="font-stat tabular-nums">
                  {Number(row.stokSaatIni).toLocaleString("id-ID")}
                </TableCell>
                <TableCell>
                  <StatusBadge status={status}>{label}</StatusBadge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
