import { describe, expect, it } from "vitest";
import { getSiteLabCatalog, listSiteLabs } from "../src/services/siteLabCatalog.js";

describe("site lab catalog", () => {
  it("lists runnable labs from the filesystem", () => {
    const labs = listSiteLabs();

    expect(labs.length).toBeGreaterThanOrEqual(34);
    expect(labs.find((lab) => lab.id === "linux-terminal")).toMatchObject({
      category: "Starter",
      runtimeImage: "winlab-lab-runner:latest",
      status: "runnable",
    });
    expect(labs.find((lab) => lab.id === "network-lab")).toMatchObject({
      status: "runnable",
    });
  });

  it("builds starter ids and runtime summary for the site", () => {
    const catalog = getSiteLabCatalog();

    expect(catalog.total).toBe(catalog.labs.length);
    expect(catalog.runtimeImages).toEqual(["winlab-lab-runner:latest"]);
    expect(catalog.starterIds).toContain("linux-terminal");
    expect(catalog.starterIds).toContain("apache-config-error");
  });
});
