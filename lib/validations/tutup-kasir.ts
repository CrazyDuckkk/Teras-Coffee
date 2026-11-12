import { z } from "zod";

const jumlahUang = z
  .number()
  .finite("Jumlah uang tidak valid")
  .min(0, "Jumlah uang tidak boleh negatif")
  .max(9_999_999_999.99, "Jumlah uang terlalu besar")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, "Jumlah uang maksimal 2 angka desimal");

export const tutupKasirSchema = z.object({
  kasAwal: jumlahUang,
  kasFisik: jumlahUang,
  qrisTerhitung: jumlahUang,
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
});

export const jamTutupKasirSchema = z.object({
  jam: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Gunakan format jam HH:MM"),
});

export type TutupKasirInput = z.infer<typeof tutupKasirSchema>;
