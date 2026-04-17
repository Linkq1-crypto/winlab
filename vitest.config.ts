import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.spec.ts", "realism/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000,
  },
});
