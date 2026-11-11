import { z } from "zod";

export const cashierCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(12, "Password minimal 12 karakter").max(128),
});

export const cashierStatusSchema = z.object({
  isActive: z.boolean(),
});
