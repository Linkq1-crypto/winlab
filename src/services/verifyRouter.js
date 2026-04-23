import { getLabConfig } from "../config/labCatalog.js";

export function resolveVerifyDefinition(labId) {
  const lab = getLabConfig(labId);
  if (!lab) throw new Error(`Unknown labId: ${labId}`);

  if (lab.verifyCommand?.cmd) {
    return normalizeCommandVerify(lab.verifyCommand);
  }

  switch (labId) {
    case "memory-leak":
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "verify:memory-leak"],
        timeoutMs: 15_000,
      };
    case "nginx-port-conflict":
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "verify:nginx-port-conflict"],
        timeoutMs: 15_000,
      };
    case "permission-denied":
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "verify:permission-denied"],
        timeoutMs: 15_000,
      };
    case "real-server":
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "verify:real-server"],
        timeoutMs: 20_000,
      };
    case "sssd-ldap":
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "verify:sssd-ldap"],
        timeoutMs: 20_000,
      };
    default:
      return {
        type: "command",
        cmd: "npm",
        args: ["run", "test:unit"],
        timeoutMs: 20_000,
      };
  }
}

export async function runVerifyForLab({ labId, workspace, runProcess, env = {} }) {
  if (typeof runProcess !== "function") {
    throw new Error("runVerifyForLab requires runProcess");
  }

  const verify = resolveVerifyDefinition(labId);

  switch (verify.type) {
    case "command": {
      const result = await runProcess(verify.cmd, verify.args, {
        cwd: workspace,
        timeoutMs: verify.timeoutMs,
        env,
      });

      return {
        ok: result.ok,
        output: result.output,
        timeout: !!result.timeout,
        metrics: {
          exitCode: result.exitCode,
          verifyType: "command",
        },
      };
    }
    default:
      throw new Error(`Unsupported verify type for ${labId}: ${verify.type}`);
  }
}

function normalizeCommandVerify(verifyCommand) {
  return {
    type: "command",
    cmd: verifyCommand.cmd,
    args: Array.isArray(verifyCommand.args) ? verifyCommand.args : [],
    timeoutMs: Number(verifyCommand.timeoutMs || 15_000),
  };
}

export default { resolveVerifyDefinition, runVerifyForLab };
