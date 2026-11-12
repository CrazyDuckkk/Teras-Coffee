import { z } from "zod";

export const satuanSchema = z.enum(["gram", "ml", "pcs"]);

export const bahanBakuCreateSchema = z.object({
  nama: z.string().trim().min(1, "Nama bahan wajib diisi"),
  satuan: satuanSchema,
  // Qty awal wajib > 0 karena dipakai membagi totalHargaBeliAwal jadi harga per satuan
  // (mis. beli 1000ml susu seharga Rp40.000 -> harga aktif Rp40/ml).
  stokAwal: z.coerce.number().positive("Stok awal wajib diisi dan lebih dari 0"),
  batasMinimumStok: z.coerce.number().min(0, "Batas minimum stok tidak boleh negatif"),
  totalHargaBeliAwal: z.coerce.number().positive("Total harga beli wajib diisi dan lebih dari 0"),
});
export type BahanBakuCreateInput = z.infer<typeof bahanBakuCreateSchema>;

export const bahanBakuUpdateSchema = z.object({
  nama: z.string().trim().min(1, "Nama bahan wajib diisi").optional(),
  satuan: satuanSchema.optional(),
  batasMinimumStok: z.coerce.number().min(0, "Batas minimum stok tidak boleh negatif").optional(),
});
export type BahanBakuUpdateInput = z.infer<typeof bahanBakuUpdateSchema>;

export const stockMasukCreateSchema = z.object({
  bahanBakuId: z.string().uuid("Bahan baku tidak valid"),
  qty: z
    .coerce.number()
    .finite("Qty tidak valid")
    .positive("Qty harus lebih dari 0")
    .max(9_999_999_999.99, "Qty terlalu besar")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, "Qty maksimal 2 angka desimal"),
  // Total uang yang dibayar untuk pembelian ini (bukan harga per satuan) — harga per
  // satuan/Harga Aktif dihitung otomatis = totalHargaBeli / qty.
  totalHargaBeli: z
    .coerce.number()
    .finite("Total harga beli tidak valid")
    .positive("Total harga beli harus lebih dari 0")
    .max(9_999_999_999.99, "Total harga beli terlalu besar")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
      "Total harga beli maksimal 2 angka desimal"
    ),
  dibayarDari: z.enum(["kas_laci", "di_luar_laci"]),
}).superRefine(({ qty, totalHargaBeli }, ctx) => {
  if (Math.round((totalHargaBeli / qty) * 100) <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["totalHargaBeli"],
      message: "Harga per satuan terlalu kecil",
    });
  }
});
export type StockMasukCreateInput = z.infer<typeof stockMasukCreateSchema>;

export const keputusanHargaStockMasukSchema = z.object({
  keputusan: z.enum(["setujui", "tolak"]),
});

export const koreksiStockMasukSchema = z.object({
  alasan: z.string().trim().min(3, "Alasan koreksi wajib diisi").max(500),
});
