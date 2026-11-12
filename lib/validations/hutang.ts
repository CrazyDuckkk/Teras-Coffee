import { z } from "zod";

export const METODE_PEMBAYARAN_HUTANG = ["tunai", "qris"] as const;

export const pembayaranHutangSchema = z.object({
  jumlah: z.coerce
    .number({ error: "Jumlah pembayaran harus berupa angka" })
    .positive("Jumlah pembayaran harus lebih dari 0")
    .max(9_999_999_999, "Jumlah pembayaran terlalu besar")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Maksimal dua angka di belakang koma"),
  metode: z.enum(METODE_PEMBAYARAN_HUTANG, { error: "Metode pembayaran harus tunai atau QRIS" }),
});
export type PembayaranHutangInput = z.infer<typeof pembayaranHutangSchema>;

export const batalPembayaranSchema = z.object({
  alasan: z.string().trim().min(1, "Alasan wajib diisi").max(500, "Alasan maksimal 500 karakter"),
});
