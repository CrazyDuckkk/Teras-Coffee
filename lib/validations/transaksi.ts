import { z } from "zod";

export const cartItemSchema = z.object({
  menuId: z.string().uuid("Menu tidak valid"),
  qty: z.coerce.number().int("Qty harus bilangan bulat").positive("Qty harus lebih dari 0"),
});

export const transaksiCreateSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Keranjang tidak boleh kosong"),
  metodeBayar: z.enum(["tunai", "hutang"]).default("tunai"),
  namaPelanggan: z.string().trim().min(1).optional(),
});
export type TransaksiCreateInput = z.infer<typeof transaksiCreateSchema>;
