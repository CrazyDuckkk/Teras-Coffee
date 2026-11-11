/**
 * Membuat satu akun owner. Tidak lewat endpoint sign-up publik (emailAndPassword.disableSignUp
 * = true di lib/auth.ts memblokir itu) — script ini memakai internalAdapter Better Auth
 * langsung lewat auth.$context, dengan password di-hash oleh Better Auth sendiri.
 *
 * Jalankan: npm run db:seed
 */
export {};

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local tidak ada — env var diharapkan sudah diset lewat cara lain
}

async function main() {
  const { auth } = await import("../lib/auth");

  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME ?? "Pemilik Kedai";

  if (!email || !password) {
    throw new Error("OWNER_EMAIL dan OWNER_PASSWORD wajib diset di .env.local");
  }

  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email.toLowerCase());
  if (existing) {
    console.log(`Akun owner dengan email ${email} sudah ada — dilewati.`);
    process.exit(0);
  }

  const hashedPassword = await ctx.password.hash(password);
  const user = await ctx.internalAdapter.createUser({
    email: email.toLowerCase(),
    name,
    emailVerified: true,
    role: "owner",
    isActive: true,
  });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  });

  console.log(`Akun owner berhasil dibuat: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed owner gagal:", err);
  process.exit(1);
});
