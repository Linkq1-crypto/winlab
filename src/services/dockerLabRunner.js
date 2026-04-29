import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_LAB_IMAGE = "winlab-lab-runner:latest";
const LAB_IMAGE = process.env.LAB_IMAGE || DEFAULT_LAB_IMAGE;
const EXEC_TIMEOUT_MS = process.env.EXEC_TIMEOUT_MS ? Number(process.env.EXEC_TIMEOUT_MS) : 10_000;
const AUTO_BUILD_LOCAL_IMAGE = process.env.LAB_IMAGE_AUTO_BUILD !== "false";

let imageReadyPromise = null;

function sanitizeToken(value, fallback) {
  const safe = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe || fallback;
}

function getContainerName(sessionId) {
  return `winlab-lab-${sanitizeToken(sessionId, "default")}`;
}

function normalizeDockerMessage(error) {
  return String(error?.stderr || error?.stdout || error?.message || "").trim();
}

function isDockerUnavailableError(error) {
  const message = normalizeDockerMessage(error).toLowerCase();
  return (
    message.includes("failed to connect to the docker api") ||
    message.includes("docker daemon") ||
    message.includes("open //./pipe/docker_engine") ||
    message.includes("cannot find the file specified") ||
    message.includes("impossibile trovare il file specificato")
  );
}

function isMissingImageError(error, imageName = LAB_IMAGE) {
  const message = normalizeDockerMessage(error).toLowerCase();
  return (
    message.includes(`unable to find image '${String(imageName).toLowerCase()}' locally`) ||
    message.includes("no such image") ||
    message.includes("no such object") ||
    message.includes("pull access denied")
  );
}

function shouldAutoBuildLabImage(imageName = LAB_IMAGE) {
  return AUTO_BUILD_LOCAL_IMAGE && imageName === DEFAULT_LAB_IMAGE;
}

function buildDockerSetupError(message) {
  const error = new Error(message);
  error.name = "DockerLabSetupError";
  return error;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }

      const error = new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function ensureLabImageReady({ run = runProcess, imageName = LAB_IMAGE } = {}) {
  try {
    await run("docker", ["image", "inspect", imageName]);
    return { ready: true, built: false, imageName };
  } catch (error) {
    if (isDockerUnavailableError(error)) {
      throw buildDockerSetupError(
        "Docker is not available. Start Docker Desktop (or the Docker daemon) and try again."
      );
    }

    if (!shouldAutoBuildLabImage(imageName) || !isMissingImageError(error, imageName)) {
      throw error;
    }
  }

  try {
    await run("docker", [
      "build",
      "-t",
      imageName,
      "-f",
      "docker/lab-runner/Dockerfile",
      ".",
    ]);
    return { ready: true, built: true, imageName };
  } catch (error) {
    if (isDockerUnavailableError(error)) {
      throw buildDockerSetupError(
        "Docker is not available. Start Docker Desktop (or the Docker daemon) and try again."
      );
    }

    throw buildDockerSetupError(
      `Lab runner image ${imageName} is missing and automatic build failed. Run \`npm run lab:build-image\` from the repo root, then retry.`
    );
  }
}

async function ensureLabRuntimeReady() {
  if (!imageReadyPromise) {
    imageReadyPromise = ensureLabImageReady().finally(() => {
      imageReadyPromise = null;
    });
  }

  return imageReadyPromise;
}

export async function isContainerRunning(containerName) {
  try {
    const { stdout } = await runProcess("docker", [
      "inspect", "--format", "{{.State.Running}}", containerName,
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function execCommandInContainer({ sessionId, command }) {
  const containerName = getContainerName(sanitizeToken(sessionId, "default"));

  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["exec", containerName, "bash", "-c", command],
      { cwd: REPO_ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ exitCode: 124, stdout, stderr: "Command timed out" });
    }, EXEC_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout: "", stderr: err.message });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export async function startDockerLabSession({ labId, sessionId, variantId, levelId }) {
  const safeLabId     = sanitizeToken(labId,      "disk-full");
  const safeSessionId = sanitizeToken(sessionId,  "default");
  const safeVariantId = variantId ? sanitizeToken(variantId, "default") : "";
  const safeLevelId = sanitizeToken(levelId || "junior", "junior").toUpperCase();
  const containerName = getContainerName(safeSessionId);

  // Remove a stale container with the same name before starting a fresh one
  try {
    await runProcess("docker", ["rm", "-f", containerName]);
  } catch { /* no-op if it doesn't exist */ }

  await ensureLabRuntimeReady();

  try {
    await runProcess("docker", [
      "run",
      "--name", containerName,
      "--rm",
      "-d",
      "--network", "none",
      "--memory", "256m",
      "--cpus", "0.5",
      "-e", `LAB_ID=${safeLabId}`,
      "-e", `LAB_VARIANT=${safeVariantId}`,
      "-e", `LAB_LEVEL=${safeLevelId}`,
      LAB_IMAGE,
    ]);
  } catch (error) {
    if (isDockerUnavailableError(error)) {
      throw buildDockerSetupError(
        "Docker is not available. Start Docker Desktop (or the Docker daemon) and try again."
      );
    }

    if (isMissingImageError(error, LAB_IMAGE)) {
      throw buildDockerSetupError(
        `Lab runner image ${LAB_IMAGE} is missing. Run \`npm run lab:build-image\` from the repo root, then retry.`
      );
    }

    throw error;
  }

  return {
    labId:      safeLabId,
    variantId:  safeVariantId || null,
    levelId:    safeLevelId,
    sessionId:  safeSessionId,
    containerName,
    shellCommand: getDockerLabShellCommand({ sessionId: safeSessionId }),
  };
}

export async function stopDockerLabSession({ sessionId }) {
  const safeSessionId = sanitizeToken(sessionId, "default");
  const containerName = getContainerName(safeSessionId);

  try {
    await runProcess("docker", ["rm", "-f", containerName]);
  } catch (error) {
    if (String(error.stderr || error.message || "").includes("No such container")) {
      return { sessionId: safeSessionId, containerName, stopped: false };
    }
    throw error;
  }

  return { sessionId: safeSessionId, containerName, stopped: true };
}

export async function verifyDockerLabSession({ labId, sessionId }) {
  const safeLabId = sanitizeToken(labId, "disk-full");
  const safeSessionId = sanitizeToken(sessionId, "default");
  const containerName = getContainerName(safeSessionId);

  try {
    const result = await runProcess("docker", [
      "exec",
      containerName,
      "bash",
      `/labs/${safeLabId}/verify.sh`,
    ]);
    return { ok: true, success: true, containerName, ...result };
  } catch (error) {
    return {
      ok: false,
      success: false,
      containerName,
      code: error.code ?? 1,
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
    };
  }
}

export function getDockerLabShellCommand({ sessionId }) {
  const safeSessionId = sanitizeToken(sessionId, "default");
  return `docker exec -it ${getContainerName(safeSessionId)} bash`;
}

export function getDockerShellCommand({ sessionId }) {
  return getDockerLabShellCommand({ sessionId });
}

export default {
  startDockerLabSession,
  stopDockerLabSession,
  verifyDockerLabSession,
  execCommandInContainer,
  isContainerRunning,
  getDockerLabShellCommand,
  getDockerShellCommand,
};

export const _test = {
  sanitizeToken,
  getContainerName,
  normalizeDockerMessage,
  isDockerUnavailableError,
  isMissingImageError,
  shouldAutoBuildLabImage,
  ensureLabImageReady,
};
