import { cn } from "@/lib/utils";

export type BadgeStatus = "success" | "warning" | "danger";

const STATUS_CLASSES: Record<BadgeStatus, string> = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
};

export function StatusBadge({ status, children }: { status: BadgeStatus; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status]
      )}
    >
      {children}
    </span>
  );
}

/** Status stok bahan baku — Kritis: stok=0, Menipis: 0<stok<=batas, Aman: di atas batas. */
export function stokStatus(stokSaatIni: number, batasMinimumStok: number): { status: BadgeStatus; label: string } {
  if (stokSaatIni <= 0) return { status: "danger", label: "Kritis" };
  if (stokSaatIni <= batasMinimumStok) return { status: "warning", label: "Menipis" };
  return { status: "success", label: "Aman" };
}
