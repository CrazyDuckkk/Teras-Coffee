import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { account, session, user } from "@/db/schema/auth";
import { requireRole } from "@/lib/auth-guard";

export class EmailKasirSudahDipakaiError extends Error {
  constructor() {
    super("Email tersebut sudah digunakan.");
    this.name = "EmailKasirSudahDipakaiError";
  }
}

export async function listKasir() {
  await requireRole("owner");

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.role, "cashier"))
    .orderBy(desc(user.createdAt));
}

export async function createKasir(input: {
  name: string;
  email: string;
  password: string;
}) {
  await requireRole("owner");

  const context = await auth.$context;
  const hashedPassword = await context.password.hash(input.password);
  const id = crypto.randomUUID();
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(user)
        .values({
          id,
          name: input.name,
          email: input.email,
          emailVerified: true,
          role: "cashier",
          isActive: true,
        })
        .returning({
          id: user.id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt,
        });

      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      return created;
    });
  } catch (error) {
    if (isEmailUniqueViolation(error)) throw new EmailKasirSudahDipakaiError();
    throw error;
  }
}

export async function setKasirAktif(id: string, isActive: boolean) {
  await requireRole("owner");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(user)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(user.id, id), eq(user.role, "cashier")))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      });

    if (!updated) return null;

    if (!isActive) {
      await tx.delete(session).where(eq(session.userId, id));
    }

    return updated;
  });
}

function isEmailUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "user_email_unique"
  ) {
    return true;
  }
  return "cause" in error && isEmailUniqueViolation(error.cause);
}
