import bcrypt from "bcryptjs";
import express from "express";
import {
  ENTERPRISE_ROLES,
  buildEnterpriseIdentityPayload,
  getEnterpriseMemberships,
  getWorkspaceMembership,
  hasEnterpriseRole,
  normalizeEnterpriseRole,
  slugifyWorkspaceName,
} from "../../services/enterpriseAccess.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_REGEX.test(normalizeEmail(value));
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildWorkspaceSummary(membership) {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization?.name || "",
    organizationSlug: membership.organization?.slug || "",
    workspaceId: membership.workspace?.id || null,
    workspaceName: membership.workspace?.name || null,
    workspaceSlug: membership.workspace?.slug || null,
    role: membership.role,
  };
}

export function createEnterpriseRouter({
  prisma,
  requireAuth,
  authLimiter,
  issueAuthSession,
}) {
  const router = express.Router();

  async function requireEnterpriseAuth(req, res, next) {
    return requireAuth(req, res, async () => {
      try {
        const memberships = await getEnterpriseMemberships(prisma, req.user.id);
        if (!memberships.length) {
          return res.status(403).json({ ok: false, error: "Enterprise access required" });
        }
        req.enterpriseMemberships = memberships;
        next();
      } catch (error) {
        console.error("requireEnterpriseAuth error:", error);
        return res.status(500).json({ ok: false, error: "Enterprise authorization failed" });
      }
    });
  }

  async function requireWorkspaceRole(req, res, next, minimumRole = "ENGINEER") {
    try {
      const membership = await getWorkspaceMembership(prisma, {
        userId: req.user.id,
        workspaceId: req.params.workspaceId,
      });

      if (!membership) {
        return res.status(403).json({ ok: false, error: "Workspace access denied" });
      }

      if (!hasEnterpriseRole(membership.role, minimumRole)) {
        return res.status(403).json({ ok: false, error: `${minimumRole} role required` });
      }

      req.enterpriseMembership = membership;
      next();
    } catch (error) {
      console.error("requireWorkspaceRole error:", error);
      return res.status(500).json({ ok: false, error: "Workspace authorization failed" });
    }
  }

  router.post("/bootstrap", requireAuth, async (req, res) => {
    try {
      const { organizationName, workspaceName } = req.body || {};
      const orgName = String(organizationName || "").trim();
      const wsName = String(workspaceName || organizationName || "").trim();

      if (!orgName || !wsName) {
        return res.status(400).json({ ok: false, error: "organizationName and workspaceName are required" });
      }

      const existingMembership = await prisma.organizationMembership.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (existingMembership) {
        return res.status(409).json({ ok: false, error: "User already belongs to an enterprise organization" });
      }

      const baseOrgSlug = slugifyWorkspaceName(orgName, "org");
      const baseWsSlug = slugifyWorkspaceName(wsName, "workspace");

      const [orgCount, wsCount] = await Promise.all([
        prisma.organization.count({ where: { slug: { startsWith: baseOrgSlug } } }),
        prisma.workspace.count({ where: { slug: { startsWith: baseWsSlug } } }),
      ]);

      const organization = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgCount ? `${baseOrgSlug}-${orgCount + 1}` : baseOrgSlug,
          workspaces: {
            create: {
              name: wsName,
              slug: wsCount ? `${baseWsSlug}-${wsCount + 1}` : baseWsSlug,
            },
          },
          memberships: {
            create: {
              userId: req.user.id,
              role: "OWNER",
            },
          },
        },
        include: {
          workspaces: true,
          memberships: {
            where: { userId: req.user.id },
          },
        },
      });

      const primaryWorkspace = organization.workspaces[0] || null;
      if (primaryWorkspace) {
        await prisma.organizationMembership.create({
          data: {
            organizationId: organization.id,
            workspaceId: primaryWorkspace.id,
            userId: req.user.id,
            role: "OWNER",
          },
        });
      }

      const memberships = await getEnterpriseMemberships(prisma, req.user.id);
      return res.json({
        ok: true,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        workspace: primaryWorkspace,
        enterprise: buildEnterpriseIdentityPayload(memberships),
      });
    } catch (error) {
      console.error("POST /api/enterprise/bootstrap error:", error);
      return res.status(500).json({ ok: false, error: "Failed to bootstrap enterprise organization" });
    }
  });

  router.post("/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        return res.status(400).json({ ok: false, error: "Email and password required" });
      }
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ ok: false, error: "Enter a valid email address" });
      }

      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user || user.accountStatus === "deleted") {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ ok: false, error: "Invalid credentials" });
      }

      const memberships = await getEnterpriseMemberships(prisma, user.id);
      if (!memberships.length) {
        return res.status(403).json({ ok: false, error: "No enterprise organization is linked to this account" });
      }

      const { accessToken: token } = await issueAuthSession(res, user);
      return res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        enterprise: buildEnterpriseIdentityPayload(memberships),
      });
    } catch (error) {
      console.error("POST /api/enterprise/auth/login error:", error);
      return res.status(500).json({ ok: false, error: "Enterprise login failed" });
    }
  });

  router.get("/auth/session", requireEnterpriseAuth, async (req, res) => {
    return res.json({
      ok: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        isAdmin: req.user.isAdmin,
      },
      enterprise: buildEnterpriseIdentityPayload(req.enterpriseMemberships),
    });
  });

  router.get("/workspaces", requireEnterpriseAuth, async (req, res) => {
    return res.json({
      ok: true,
      workspaces: req.enterpriseMemberships
        .filter((membership) => membership.workspaceId && membership.workspace)
        .map(buildWorkspaceSummary),
    });
  });

  router.get("/workspaces/:workspaceId/dashboard", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "OBSERVER"),
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      const [activeSessionRows, completedCount, failedCount, successfulSessions, timeline, campaigns] = await Promise.all([
        prisma.enterpriseIncidentSession.findMany({
          where: { workspaceId, status: "active" },
          select: { userId: true },
        }),
        prisma.enterpriseIncidentSession.count({
          where: { workspaceId, success: true, status: { in: ["completed", "resolved"] } },
        }),
        prisma.enterpriseIncidentSession.count({
          where: { workspaceId, success: false, status: { in: ["failed", "abandoned"] } },
        }),
        prisma.enterpriseIncidentSession.findMany({
          where: { workspaceId, success: true, durationMs: { not: null } },
          select: { durationMs: true },
        }),
        prisma.enterpriseIncidentTimelineEvent.findMany({
          where: { session: { workspaceId } },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            session: {
              select: { id: true, labId: true, status: true },
            },
          },
        }),
        prisma.enterpriseCampaign.findMany({
          where: { workspaceId },
          orderBy: { startsAt: "desc" },
          take: 5,
          include: {
            enrollments: {
              select: { status: true },
            },
          },
        }),
      ]);

      const activeEngineers = new Set(activeSessionRows.map((row) => row.userId)).size;
      const mttrMs = successfulSessions.length
        ? Math.round(successfulSessions.reduce((sum, item) => sum + (item.durationMs || 0), 0) / successfulSessions.length)
        : null;
      const readinessScore = calculateReadinessScore({
        completedCount,
        failedCount,
        mttrMs,
        activeEngineers,
      });

      return res.json({
        ok: true,
        workspace: buildWorkspaceSummary(req.enterpriseMembership),
        metrics: {
          activeEngineers,
          completedIncidents: completedCount,
          failedAttempts: failedCount,
          mttrMs,
          readinessScore,
        },
        timelines: timeline.map((event) => ({
          id: event.id,
          sessionId: event.sessionId,
          labId: event.session?.labId || null,
          sessionStatus: event.session?.status || null,
          type: event.type,
          actorType: event.actorType,
          actorId: event.actorId,
          payload: safeJsonParse(event.payloadJson, null),
          createdAt: event.createdAt,
        })),
        campaigns: campaigns.map((campaign) => {
          const total = campaign.enrollments.length;
          const completed = campaign.enrollments.filter((item) => item.status === "completed").length;
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
            completionRate: total ? Math.round((completed / total) * 100) : 0,
          };
        }),
      });
    } catch (error) {
      console.error("GET /api/enterprise/workspaces/:workspaceId/dashboard error:", error);
      return res.status(500).json({ ok: false, error: "Failed to load enterprise dashboard" });
    }
  });

  router.get("/workspaces/:workspaceId/members", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "OBSERVER"),
  async (req, res) => {
    try {
      const organizationId = req.enterpriseMembership.organizationId;
      const workspaceId = req.params.workspaceId;
      const memberships = await prisma.organizationMembership.findMany({
        where: {
          organizationId,
          OR: [{ workspaceId }, { workspaceId: null }],
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, accountStatus: true },
          },
        },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      });

      return res.json({
        ok: true,
        members: memberships.map((membership) => ({
          id: membership.id,
          role: membership.role,
          workspaceId: membership.workspaceId,
          user: membership.user,
        })),
      });
    } catch (error) {
      console.error("GET /api/enterprise/workspaces/:workspaceId/members error:", error);
      return res.status(500).json({ ok: false, error: "Failed to load workspace members" });
    }
  });

  router.post("/workspaces/:workspaceId/members", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "ADMIN"),
  async (req, res) => {
    try {
      const { email, role = "ENGINEER", scope = "workspace" } = req.body || {};
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ ok: false, error: "Valid email required" });
      }

      const normalizedRole = normalizeEnterpriseRole(role, "ENGINEER");
      if (!ENTERPRISE_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ ok: false, error: "Invalid enterprise role" });
      }

      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const workspaceId = scope === "organization" ? null : req.params.workspaceId;
      const membership = await prisma.organizationMembership.upsert({
        where: {
          organizationId_workspaceId_userId: {
            organizationId: req.enterpriseMembership.organizationId,
            workspaceId,
            userId: user.id,
          },
        },
        update: {
          role: normalizedRole,
          invitedById: req.user.id,
        },
        create: {
          organizationId: req.enterpriseMembership.organizationId,
          workspaceId,
          userId: user.id,
          role: normalizedRole,
          invitedById: req.user.id,
        },
      });

      return res.status(201).json({ ok: true, membership });
    } catch (error) {
      console.error("POST /api/enterprise/workspaces/:workspaceId/members error:", error);
      return res.status(500).json({ ok: false, error: "Failed to add workspace member" });
    }
  });

  router.get("/workspaces/:workspaceId/campaigns", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "OBSERVER"),
  async (req, res) => {
    try {
      const campaigns = await prisma.enterpriseCampaign.findMany({
        where: { workspaceId: req.params.workspaceId },
        include: {
          incidents: true,
          enrollments: true,
        },
        orderBy: { startsAt: "desc" },
      });
      return res.json({ ok: true, campaigns });
    } catch (error) {
      console.error("GET /api/enterprise/workspaces/:workspaceId/campaigns error:", error);
      return res.status(500).json({ ok: false, error: "Failed to load campaigns" });
    }
  });

  router.post("/workspaces/:workspaceId/campaigns", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "ADMIN"),
  async (req, res) => {
    try {
      const { name, description, startsAt, endsAt, incidents = [] } = req.body || {};
      const start = parseDate(startsAt);
      const end = parseDate(endsAt);
      if (!name || !start || !end || end <= start) {
        return res.status(400).json({ ok: false, error: "name, startsAt, and endsAt are required" });
      }

      const campaign = await prisma.enterpriseCampaign.create({
        data: {
          organizationId: req.enterpriseMembership.organizationId,
          workspaceId: req.params.workspaceId,
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          startsAt: start,
          endsAt: end,
          status: "draft",
          createdById: req.user.id,
          incidents: {
            create: Array.isArray(incidents)
              ? incidents
                  .filter((item) => item && item.labId)
                  .map((item, index) => ({
                    labId: String(item.labId).trim(),
                    incidentSeed: item.incidentSeed ? String(item.incidentSeed).trim() : null,
                    variantId: item.variantId ? String(item.variantId).trim() : null,
                    sequenceOrder: Number.isInteger(item.sequenceOrder) ? item.sequenceOrder : index,
                    required: item.required !== false,
                  }))
              : [],
          },
        },
        include: {
          incidents: true,
        },
      });

      return res.status(201).json({ ok: true, campaign });
    } catch (error) {
      console.error("POST /api/enterprise/workspaces/:workspaceId/campaigns error:", error);
      return res.status(500).json({ ok: false, error: "Failed to create enterprise campaign" });
    }
  });

  router.get("/workspaces/:workspaceId/incidents", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "OBSERVER"),
  async (req, res) => {
    try {
      const assignments = await prisma.enterpriseIncidentAssignment.findMany({
        where: { workspaceId: req.params.workspaceId },
        orderBy: { createdAt: "desc" },
        include: {
          sessions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });
      return res.json({ ok: true, incidents: assignments });
    } catch (error) {
      console.error("GET /api/enterprise/workspaces/:workspaceId/incidents error:", error);
      return res.status(500).json({ ok: false, error: "Failed to load incident assignments" });
    }
  });

  router.post("/workspaces/:workspaceId/incidents", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "ADMIN"),
  async (req, res) => {
    try {
      const { labId, incidentSeed, variantId, title, assignedTeam, dueAt, campaignId } = req.body || {};
      if (!labId) {
        return res.status(400).json({ ok: false, error: "labId is required" });
      }

      const assignment = await prisma.enterpriseIncidentAssignment.create({
        data: {
          organizationId: req.enterpriseMembership.organizationId,
          workspaceId: req.params.workspaceId,
          campaignId: campaignId || null,
          labId: String(labId).trim(),
          incidentSeed: incidentSeed ? String(incidentSeed).trim() : null,
          variantId: variantId ? String(variantId).trim() : null,
          title: title ? String(title).trim() : null,
          assignedTeam: assignedTeam ? String(assignedTeam).trim() : null,
          assignedById: req.user.id,
          dueAt: parseDate(dueAt),
          status: "assigned",
        },
      });

      return res.status(201).json({ ok: true, incident: assignment });
    } catch (error) {
      console.error("POST /api/enterprise/workspaces/:workspaceId/incidents error:", error);
      return res.status(500).json({ ok: false, error: "Failed to create incident assignment" });
    }
  });

  router.post("/workspaces/:workspaceId/sessions", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "ENGINEER"),
  async (req, res) => {
    try {
      const { assignmentId, labId, status = "active" } = req.body || {};
      const resolvedLabId = String(labId || "").trim();
      if (!resolvedLabId && !assignmentId) {
        return res.status(400).json({ ok: false, error: "assignmentId or labId is required" });
      }

      const assignment = assignmentId
        ? await prisma.enterpriseIncidentAssignment.findFirst({
            where: {
              id: assignmentId,
              workspaceId: req.params.workspaceId,
            },
          })
        : null;

      const session = await prisma.enterpriseIncidentSession.create({
        data: {
          organizationId: req.enterpriseMembership.organizationId,
          workspaceId: req.params.workspaceId,
          assignmentId: assignment?.id || null,
          userId: req.user.id,
          labId: assignment?.labId || resolvedLabId,
          campaignId: assignment?.campaignId || null,
          status: String(status || "active").trim().toLowerCase(),
        },
      });

      await prisma.enterpriseIncidentTimelineEvent.create({
        data: {
          sessionId: session.id,
          type: "session_started",
          actorType: "user",
          actorId: req.user.id,
          payloadJson: JSON.stringify({
            assignmentId: assignment?.id || null,
            labId: session.labId,
          }),
        },
      });

      return res.status(201).json({ ok: true, session });
    } catch (error) {
      console.error("POST /api/enterprise/workspaces/:workspaceId/sessions error:", error);
      return res.status(500).json({ ok: false, error: "Failed to start enterprise session" });
    }
  });

  router.post("/workspaces/:workspaceId/sessions/:sessionId/complete", requireEnterpriseAuth, (req, res, next) =>
    requireWorkspaceRole(req, res, next, "ENGINEER"),
  async (req, res) => {
    try {
      const { success = true, failureReason, readinessScore } = req.body || {};
      const session = await prisma.enterpriseIncidentSession.findFirst({
        where: {
          id: req.params.sessionId,
          workspaceId: req.params.workspaceId,
        },
      });
      if (!session) {
        return res.status(404).json({ ok: false, error: "Enterprise session not found" });
      }

      const endedAt = new Date();
      const durationMs = Math.max(0, endedAt.getTime() - new Date(session.startedAt).getTime());
      const updated = await prisma.enterpriseIncidentSession.update({
        where: { id: session.id },
        data: {
          endedAt,
          durationMs,
          success: !!success,
          failureReason: success ? null : String(failureReason || "unknown"),
          readinessScore: Number.isFinite(Number(readinessScore)) ? Number(readinessScore) : null,
          status: success ? "completed" : "failed",
        },
      });

      await prisma.enterpriseIncidentTimelineEvent.create({
        data: {
          sessionId: session.id,
          type: success ? "session_completed" : "session_failed",
          actorType: "user",
          actorId: req.user.id,
          payloadJson: JSON.stringify({
            durationMs,
            readinessScore: updated.readinessScore,
            failureReason: updated.failureReason,
          }),
        },
      });

      return res.json({ ok: true, session: updated });
    } catch (error) {
      console.error("POST /api/enterprise/workspaces/:workspaceId/sessions/:sessionId/complete error:", error);
      return res.status(500).json({ ok: false, error: "Failed to complete enterprise session" });
    }
  });

  return router;
}

function calculateReadinessScore({
  completedCount,
  failedCount,
  mttrMs,
  activeEngineers,
}) {
  const throughputScore = Math.min(40, completedCount * 4);
  const participationScore = Math.min(20, activeEngineers * 4);
  const reliabilityScore = Math.max(0, 30 - failedCount * 3);
  const recoveryScore = mttrMs == null
    ? 10
    : Math.max(0, Math.min(10, 10 - Math.round(mttrMs / 600000)));

  return Math.max(0, Math.min(100, throughputScore + participationScore + reliabilityScore + recoveryScore));
}

export default createEnterpriseRouter;
