import { describe, expect, it } from "vitest";
import { explainDiff } from "../src/services/explainDiff.js";

describe("explainDiff", () => {
  it("summarizes changed lines without counting diff headers", () => {
    const summary = explainDiff([
      "diff --git a/file.js b/file.js",
      "--- a/file.js",
      "+++ b/file.js",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n"));

    expect(summary).toContain("1 lines added");
    expect(summary).toContain("1 lines removed");
  });
});
