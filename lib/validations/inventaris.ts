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
  qty: z.coerce.number().positive("Qty harus lebih dari 0"),
  // Total uang yang dibayar untuk pembelian ini (bukan harga per satuan) — harga per
  // satuan/Harga Aktif dihitung otomatis = totalHargaBeli / qty.
  totalHargaBeli: z.coerce.number().positive("Total harga beli harus lebih dari 0"),
});
export type StockMasukCreateInput = z.infer<typeof stockMasukCreateSchema>;
