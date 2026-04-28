import { afterEach, describe, expect, it, vi } from "vitest";
import { _test as dockerLabRunnerTest } from "../src/services/dockerLabRunner.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("docker lab runner preflight", () => {
  it("detects when Docker is unavailable", () => {
    expect(
      dockerLabRunnerTest.isDockerUnavailableError({
        stderr: "failed to connect to the docker API at npipe:////./pipe/docker_engine",
      })
    ).toBe(true);

    expect(
      dockerLabRunnerTest.isDockerUnavailableError({
        stderr: "open //./pipe/docker_engine: Impossibile trovare il file specificato.",
      })
    ).toBe(true);
  });

  it("detects a missing local lab image from docker output", () => {
    expect(
      dockerLabRunnerTest.isMissingImageError({
        stderr: "Unable to find image 'winlab-lab-runner:latest' locally\npull access denied",
      })
    ).toBe(true);

    expect(
      dockerLabRunnerTest.isMissingImageError({
        stderr: "Error response from daemon: No such image: winlab-lab-runner:latest",
      })
    ).toBe(true);
  });

  it("auto-builds the default local image when missing", async () => {
    const calls: string[][] = [];
    const run = vi.fn(async (_command: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "image" && args[1] === "inspect") {
        const error: Error & { stderr?: string } = new Error("missing");
        error.stderr = "Error response from daemon: No such object: winlab-lab-runner:latest";
        throw error;
      }
      return { code: 0, stdout: "", stderr: "" };
    });

    const result = await dockerLabRunnerTest.ensureLabImageReady({ run });

    expect(result).toMatchObject({ ready: true, built: true, imageName: "winlab-lab-runner:latest" });
    expect(calls).toEqual([
      ["image", "inspect", "winlab-lab-runner:latest"],
      ["build", "-t", "winlab-lab-runner:latest", "-f", "docker/lab-runner/Dockerfile", "."],
    ]);
  });

  it("returns a setup error when Docker is offline", async () => {
    const run = vi.fn(async () => {
      const error: Error & { stderr?: string } = new Error("offline");
      error.stderr = "failed to connect to the docker API at npipe:////./pipe/docker_engine";
      throw error;
    });

    await expect(dockerLabRunnerTest.ensureLabImageReady({ run })).rejects.toThrow(
      /start docker desktop/i
    );
  });
});
