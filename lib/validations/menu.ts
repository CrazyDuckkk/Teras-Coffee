import { z } from "zod";
import { normalizeKategori } from "@/lib/format";

export const resepItemSchema = z.object({
  bahanBakuId: z.string().uuid("Bahan baku tidak valid"),
  takaran: z.coerce.number().positive("Takaran harus lebih dari 0"),
  hanyaBawaPulang: z.boolean().default(false),
});

export const menuInputSchema = z
  .object({
    nama: z.string().trim().min(1, "Nama menu wajib diisi"),
    kategori: z
      .string()
      .trim()
      .min(1, "Kategori wajib diisi")
      .transform(normalizeKategori),
    hargaJual: z.coerce.number().positive("Harga jual harus lebih dari 0"),
    resep: z.array(resepItemSchema).min(1, "Resep minimal harus punya 1 bahan"),
  })
  .refine((data) => new Set(data.resep.map((r) => r.bahanBakuId)).size === data.resep.length, {
    message: "Satu bahan tidak boleh dipilih dua kali dalam resep yang sama",
    path: ["resep"],
  });
export type MenuInput = z.infer<typeof menuInputSchema>;
