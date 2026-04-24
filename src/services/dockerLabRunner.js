import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const COMPOSE_FILE = path.join(REPO_ROOT, "docker-compose.labs.yml");

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

export async function startDockerLabSession({ labId, sessionId, variantId }) {
  const safeLabId = sanitizeToken(labId, "disk-full");
  const safeSessionId = sanitizeToken(sessionId, "default");
  const safeVariantId = variantId ? sanitizeToken(variantId, "default") : "";
  const containerName = getContainerName(safeSessionId);

  await runProcess(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "up", "-d", "--build"],
    {
      env: {
        LAB_ID: safeLabId,
        LAB_VARIANT: safeVariantId,
        LAB_CONTAINER_NAME: containerName,
      },
    }
  );

  return {
    labId: safeLabId,
    variantId: safeVariantId || null,
    sessionId: safeSessionId,
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
  getDockerLabShellCommand,
  getDockerShellCommand,
};
