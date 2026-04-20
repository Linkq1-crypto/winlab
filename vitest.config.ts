import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.spec.ts", "realism/**/*.spec.ts"],
    exclude: [
      "node_modules",
      "dist",
      "tests/fullstack.spec.ts",
      "tests/health.spec.ts",
      "tests/landing.spec.ts",
      "tests/language-integrity.spec.ts",
      "tests/language.spec.ts",
      "tests/lighthouse.spec.ts",
      "tests/mobile.spec.ts",
      "tests/network-conditions.spec.ts",
      "tests/session-resume-ui.spec.ts",
      "tests/winlab.spec.ts",
      "tests/production-readiness.spec.ts",
      "tests/security-headers.spec.ts",
      "tests/websocket.spec.ts",
      "tests/stripe-webhook.spec.ts",
      "tests/rate-limiting.spec.ts",
    ],
    testTimeout: 30000,
  },
});
