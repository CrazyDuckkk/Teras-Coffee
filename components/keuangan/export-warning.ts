import { toast } from "sonner";

export function tampilkanPeringatanEkspor(value: unknown) {
  if (!Array.isArray(value)) return;
  for (const warning of value) {
    if (typeof warning === "string") toast.warning(warning);
  }
}
