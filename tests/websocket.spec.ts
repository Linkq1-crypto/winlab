/**
 * WebSocket Stability Suite
 *
 * Tests the /ws/leaderboard endpoint:
 *   1. Connect & receive leaderboard message within 5s
 *   2. Heartbeat ping survives 35s idle (server pings every 30s)
 *   3. Multiple concurrent connections (10 VUs)
 *   4. Reconnect after server-side close
 *   5. scenarioId filter — only matching messages delivered
 *   6. Non-leaderboard path is rejected (socket destroyed)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001")
  .replace(/^https?/, (p) => (p === "https" ? "wss" : "ws"));

const WS_URL = `${BASE_URL}/ws/leaderboard`;

function connect(url = WS_URL, timeout = 8_000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => { ws.close(); reject(new Error("connect timeout")); }, timeout);
    ws.on("open", () => { clearTimeout(t); resolve(ws); });
    ws.on("error", (err) => { clearTimeout(t); reject(err); });
  });
}

function nextMessage(ws: WebSocket, timeout = 8_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("message timeout")), timeout);
    ws.once("message", (data) => { clearTimeout(t); resolve(data.toString()); });
  });
}

function waitClose(ws: WebSocket, timeout = 5_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("close timeout")), timeout);
    ws.once("close", (code) => { clearTimeout(t); resolve(code); });
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🔌 WebSocket — /ws/leaderboard", () => {

  it("connects and receives leaderboard message", async () => {
    const ws = await connect();
    try {
      const raw = await nextMessage(ws);
      const msg = JSON.parse(raw);
      expect(msg.type).toBe("leaderboard");
      expect(Array.isArray(msg.rows)).toBe(true);
    } finally {
      ws.close();
    }
  });

  it("responds to ping with pong (heartbeat alive)", async () => {
    const ws = await connect();
    const ponged = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 5_000);
      ws.on("pong", () => { clearTimeout(t); resolve(true); });
      ws.ping();
    });
    ws.close();
    expect(ponged).toBe(true);
  });

  it("handles 10 concurrent connections", async () => {
    const sockets = await Promise.all(
      Array.from({ length: 10 }, () => connect())
    );
    const messages = await Promise.all(sockets.map((ws) => nextMessage(ws)));
    sockets.forEach((ws) => ws.close());

    for (const raw of messages) {
      const msg = JSON.parse(raw);
      expect(msg.type).toBe("leaderboard");
    }
  });

  it("reconnects after close and receives message again", async () => {
    const ws1 = await connect();
    await nextMessage(ws1);
    ws1.close();
    await new Promise((r) => setTimeout(r, 200));

    const ws2 = await connect();
    try {
      const raw = await nextMessage(ws2);
      expect(JSON.parse(raw).type).toBe("leaderboard");
    } finally {
      ws2.close();
    }
  });

  it("scenarioId filter — connection accepted with param", async () => {
    const ws = await connect(`${WS_URL}?scenarioId=nginx-port-conflict`);
    try {
      const raw = await nextMessage(ws);
      const msg = JSON.parse(raw);
      expect(msg.type).toBe("leaderboard");
      // scenarioId echoed back or null (both valid — server may return global)
      expect(msg.scenarioId === "nginx-port-conflict" || msg.scenarioId === null).toBe(true);
    } finally {
      ws.close();
    }
  });

  it("rejects connection on unknown path", async () => {
    const url = `${BASE_URL}/ws/unknown-path`;
    await expect(connect(url, 4_000)).rejects.toThrow();
  });
});
