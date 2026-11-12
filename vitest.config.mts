import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL = "postgres://teras_test:teras_test@127.0.0.1:5433/teras_coffee_test";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(dirname(fileURLToPath(import.meta.url))) },
  },
  test: {
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
