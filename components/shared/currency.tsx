import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";

export function Currency({ value, className }: { value: number | string; className?: string }) {
  return <span className={cn("font-stat tabular-nums", className)}>{formatRupiah(value)}</span>;
}
