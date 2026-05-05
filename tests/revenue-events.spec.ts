import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createEventsRouter } from "../src/api/routes/events.js";
import {
  recordRevenueEvent,
  resolveIntentScore,
} from "../src/services/revenueEventEngine.js";

function createFakePrisma() {
  const store = {
    events: [] as any[],
    profiles: [] as any[],
  };

  function withDefaults(row: any) {
    return {
      labStartedCount: 0,
      commandCount: 0,
      hintRequestedCount: 0,
      verifyFailedCount: 0,
      verifyPassedCount: 0,
      pricingClickedCount: 0,
      checkoutStartedCount: 0,
      checkoutSucceededCount: 0,
      checkoutFailedCount: 0,
      checkoutAbandonedCount: 0,
      intentScore: 0,
      conversionState: "anonymous",
      paidAt: null,
      lastEventAt: null,
      ...row,
    };
  }

  function findProfile(where: any) {
    if (where.id) return store.profiles.find((row) => row.id === where.id) || null;
    if (where.userId !== undefined) return store.profiles.find((row) => row.userId === where.userId) || null;
    if (where.sessionId !== undefined) return store.profiles.find((row) => row.sessionId === where.sessionId) || null;
    return null;
  }

  function applyData(target: any, data: any) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in value) {
        target[key] = Number(target[key] || 0) + Number((value as any).increment || 0);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  const tx = {
    event: {
      async create({ data }: any) {
        const row = { id: `event-${store.events.length + 1}`, ...data };
        store.events.push(row);
        return row;
      },
    },
    userProfile: {
      async findUnique({ where }: any) {
        return findProfile(where);
      },
      async create({ data }: any) {
        const row = withDefaults({ id: `profile-${store.profiles.length + 1}`, ...data });
        store.profiles.push(row);
        return row;
      },
      async update({ where, data }: any) {
        const row = findProfile(where);
        if (!row) throw new Error("Profile not found");
        applyData(row, data);
        return row;
      },
      async delete({ where }: any) {
        const index = store.profiles.findIndex((row) => row.id === where.id);
        if (index >= 0) {
          const [removed] = store.profiles.splice(index, 1);
          return removed;
        }
        return null;
      },
    },
  };

  return {
    store,
    prisma: {
      async $transaction(callback: any) {
        return callback(tx);
      },
    },
  };
}

async function flushBackgroundWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("/api/events", () => {
  it("creates an event record for a valid request", async () => {
    const { prisma, store } = createFakePrisma();
    const app = express();
    app.use(cookieParser());
    app.use("/api", createEventsRouter({ prisma, jwtSecret: "test-secret" }));

    const response = await request(app)
      .post("/api/events")
      .send({
        event: "page_view",
        payload: { path: "/" },
        ts: "2026-05-05T10:00:00.000Z",
      });

    expect(response.status).toBe(202);
    await flushBackgroundWork();

    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      type: "page_view",
      status: "done",
      source: "revenue_engine",
    });
  });

  it("rejects an invalid event type", async () => {
    const { prisma, store } = createFakePrisma();
    const app = express();
    app.use(cookieParser());
    app.use("/api", createEventsRouter({ prisma, jwtSecret: "test-secret" }));

    const response = await request(app)
      .post("/api/events")
      .send({ event: "totally_invalid_event", payload: {} });

    expect(response.status).toBe(400);
    expect(store.events).toHaveLength(0);
  });

  it("supports anonymous sessions via session cookie", async () => {
    const { prisma, store } = createFakePrisma();
    const app = express();
    app.use(cookieParser());
    app.use("/api", createEventsRouter({ prisma, jwtSecret: "test-secret" }));

    const response = await request(app)
      .post("/api/events")
      .set("Cookie", ["winlab_session_id=session-anon-1"])
      .send({
        event: "lab_started",
        payload: { labId: "apache-config-error" },
      });

    expect(response.status).toBe(202);
    await flushBackgroundWork();

    expect(store.events[0].sessionId).toBe("session-anon-1");
    expect(store.profiles[0]).toMatchObject({
      sessionId: "session-anon-1",
      labStartedCount: 1,
      intentScore: 10,
      conversionState: "engaged",
    });
  });
});

describe("revenue scoring and sanitization", () => {
  it("updates deterministic intent score correctly", async () => {
    const { prisma, store } = createFakePrisma();

    await recordRevenueEvent({
      prisma,
      eventType: "lab_started",
      sessionId: "score-session",
      payload: { labId: "apache-config-error" },
    });

    for (let index = 0; index < 5; index += 1) {
      await recordRevenueEvent({
        prisma,
        eventType: "command_entered",
        sessionId: "score-session",
        payload: { labId: "apache-config-error", command: `echo ${index}` },
      });
    }

    await recordRevenueEvent({
      prisma,
      eventType: "pricing_clicked",
      sessionId: "score-session",
      payload: { plan: "pro" },
    });

    const profile = store.profiles[0];
    expect(resolveIntentScore(profile)).toBe(50);
    expect(profile.intentScore).toBe(50);
    expect(profile.conversionState).toBe("high_intent");
  });

  it("sanitizes command payloads before storing them", async () => {
    const { prisma, store } = createFakePrisma();

    await recordRevenueEvent({
      prisma,
      eventType: "command_entered",
      sessionId: "sanitize-session",
      payload: {
        labId: "ssh-misconfigured",
        command: 'export API_KEY=abc123 PASSWORD=hunter2 && curl -H "Authorization: Bearer super-secret-token" https://example.test',
      },
    });

    const payload = JSON.parse(store.events[0].payload);
    expect(payload.command).toContain("API_KEY=[REDACTED]");
    expect(payload.command).toContain("PASSWORD=[REDACTED]");
    expect(payload.command).toContain("Authorization=[REDACTED]");
    expect(payload.command).not.toContain("hunter2");
    expect(payload.command).not.toContain("abc123");
    expect(payload.command).not.toContain("super-secret-token");
  });
});
