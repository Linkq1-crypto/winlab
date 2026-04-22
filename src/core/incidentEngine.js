export function createIncident() {
  return {
    nginx: "down",
    disk: "ok",
    solved: false,
    attempts: 0
  };
}

export function handleCommand(state, cmd) {
  const command = cmd.trim().toLowerCase();

  let output = "";
  let next = { ...state, attempts: state.attempts + 1 };

  if (command.includes("status nginx")) {
    output = state.nginx === "down"
      ? "nginx.service - FAILED"
      : "nginx.service - RUNNING";
  }

  else if (command.includes("restart nginx")) {
    if (state.disk === "full") {
      output = "Cannot restart: disk full";
    } else {
      output = "nginx restarted successfully";
      next.nginx = "up";
      next.solved = true;
    }
  }

  else if (command.includes("df -h")) {
    output = state.disk === "full"
      ? "/dev/sda1 100% FULL"
      : "/dev/sda1 45% used";
  }

  else {
    output = "command not found";
  }

  return { output, state: next };
}