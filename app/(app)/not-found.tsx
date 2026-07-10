import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Halaman tidak ditemukan</h2>
        <p className="text-sm text-muted-foreground">Halaman yang Anda cari tidak tersedia.</p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        Kembali ke Dashboard
      </Button>
    </div>
  );
}
