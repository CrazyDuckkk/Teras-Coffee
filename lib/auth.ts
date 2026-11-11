import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as authSchema from "@/db/schema/auth";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    // Pendaftaran publik tetap mati. Owner membuat akun kasir melalui API internal.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "owner",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession) => {
          const [account] = await db
            .select({ isActive: authSchema.user.isActive })
            .from(authSchema.user)
            .where(eq(authSchema.user.id, newSession.userId))
            .limit(1);

          if (!account?.isActive) return false;
        },
      },
    },
  },
  session: {
    // Sesi persistent (owner login sekali per device, tidak berulang tiap hari).
    expiresIn: 60 * 60 * 24 * 90, // 90 hari
    updateAge: 60 * 60 * 24, // 1 hari — rolling refresh, sesi diperpanjang tiap dipakai
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      // `secure` sengaja TIDAK di-hardcode true di sini — Better Auth otomatis
      // secure di production (HTTPS di Vercel) tapi tetap jalan di localhost HTTP
      // saat dev. Hardcode true akan mematahkan login lokal (browser menolak
      // cookie Secure di koneksi non-HTTPS).
    },
  },
  plugins: [nextCookies()],
});
