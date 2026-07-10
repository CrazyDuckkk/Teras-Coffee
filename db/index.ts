import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum diset di environment");
}

// prepare:false diperlukan saat DATABASE_URL menunjuk ke Supabase transaction pooler (pgbouncer)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
