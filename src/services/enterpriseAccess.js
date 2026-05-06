const ROLE_ORDER = {
  OBSERVER: 1,
  ENGINEER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const ENTERPRISE_ROLES = Object.freeze(Object.keys(ROLE_ORDER));

export function normalizeEnterpriseRole(role, fallback = "OBSERVER") {
  const normalized = String(role || "").trim().toUpperCase();
  return ROLE_ORDER[normalized] ? normalized : fallback;
}

export function hasEnterpriseRole(role, minimumRole) {
  const current = ROLE_ORDER[normalizeEnterpriseRole(role, "")] || 0;
  const required = ROLE_ORDER[normalizeEnterpriseRole(minimumRole, "")] || 0;
  return current >= required;
}

export function slugifyWorkspaceName(value, fallback = "workspace") {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export async function getEnterpriseMemberships(prisma, userId) {
  return prisma.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: true,
      workspace: true,
    },
    orderBy: [
      { organizationId: "asc" },
      { workspaceId: "asc" },
      { createdAt: "asc" },
    ],
  });
}

export async function getWorkspaceMembership(prisma, { userId, workspaceId }) {
  return prisma.organizationMembership.findFirst({
    where: {
      userId,
      OR: [
        { workspaceId },
        {
          workspaceId: null,
          organization: {
            workspaces: {
              some: { id: workspaceId },
            },
          },
        },
      ],
    },
    include: {
      organization: true,
      workspace: true,
    },
    orderBy: [
      { workspaceId: "desc" },
      { createdAt: "asc" },
    ],
  });
}

export function buildEnterpriseIdentityPayload(memberships) {
  const byOrg = new Map();

  for (const membership of memberships) {
    const orgId = membership.organizationId;
    if (!byOrg.has(orgId)) {
      byOrg.set(orgId, {
        organizationId: orgId,
        organizationName: membership.organization?.name || "",
        organizationSlug: membership.organization?.slug || "",
        role: membership.role,
        workspaces: [],
      });
    }

    const entry = byOrg.get(orgId);
    if (hasEnterpriseRole(membership.role, entry.role)) {
      entry.role = membership.role;
    }

    if (membership.workspaceId && membership.workspace) {
      entry.workspaces.push({
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspace.name,
        workspaceSlug: membership.workspace.slug,
        role: membership.role,
      });
    }
  }

  return Array.from(byOrg.values());
}
