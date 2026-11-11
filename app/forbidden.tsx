import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldX className="size-10 text-danger-foreground" />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Akun Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/transaksi" />}>
        Kembali ke Transaksi
      </Button>
    </main>
  );
}
