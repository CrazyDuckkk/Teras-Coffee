import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../db/schema";

const TEST_DATABASE_URL = "postgres://teras_test:teras_test@127.0.0.1:5433/teras_coffee_test";

export async function setup() {
  const databaseName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error("Database tes harus memakai nama yang berakhiran _test.");
  }

  const client = postgres(TEST_DATABASE_URL, { prepare: false, connect_timeout: 5 });
  try {
    await client`select 1`;
    await migrate(drizzle(client, { schema }), {
      migrationsFolder: resolve(process.cwd(), "db/migrations"),
    });
  } catch (error) {
    throw new Error("Database tes belum siap. Jalankan npm run db:test:up terlebih dahulu.", {
      cause: error,
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
