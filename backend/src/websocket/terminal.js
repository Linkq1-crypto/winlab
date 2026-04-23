import { WebSocketServer } from "ws";
import pty from "node-pty";

export function initTerminal(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const container = url.searchParams.get("container");

    if (!container) return ws.close();

    const shell = pty.spawn("docker", [
      "exec",
      "-it",
      container,
      "sh"
    ]);

    shell.onData((data) => ws.send(data));

    ws.on("message", (msg) => {
      const cmd = msg.toString();
      shell.write(cmd);

      // AI hook
      if (cmd.includes("rm -rf")) {
        ws.send("\n[AI] ⚠️ Dangerous command detected\n");
      }
    });
  });
}
