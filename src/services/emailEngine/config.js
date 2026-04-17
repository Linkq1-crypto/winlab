/**
 * Email Engine Config — Multi-project support
 * Each project gets its own sender, domain, and signature
 */

export const projects = {
  winlab: {
    name: 'Winlab',
    from: 'Support <support@winlab.cloud>',
    domain: 'https://winlab.cloud',
    supportEmail: 'support@winlab.cloud',
    billingEmail: 'billing@winlab.cloud',
    salesEmail: 'sales@winlab.cloud',
    privacyEmail: 'privacy@winlab.cloud',
    abuseEmail: 'abuse@winlab.cloud',
    securityEmail: 'security@winlab.cloud',
  },
};

export const defaultProject = projects.winlab;

export function getProjectConfig(projectName) {
  return projects[projectName] || defaultProject;
}

/**
 * Team signatures — dynamic per department
 */
export const teamSignatures = {
  support: {
    name: 'Winlab Support',
    team: 'Support Team',
    email: 'support@winlab.cloud',
    tone: 'professional, direct, reassuring',
  },
  billing: {
    name: 'Winlab Billing',
    team: 'Billing Team',
    email: 'billing@winlab.cloud',
    tone: 'friendly, helpful, value-oriented',
  },
  sales: {
    name: 'Winlab Sales',
    team: 'Sales Team',
    email: 'sales@winlab.cloud',
    tone: 'friendly, positive, value-focused',
  },
  legal: {
    name: 'Winlab Legal',
    team: 'Privacy & Compliance',
    email: 'privacy@winlab.cloud',
    tone: 'formal, precise, neutral',
  },
  security: {
    name: 'Winlab Security',
    team: 'Security Team',
    email: 'security@winlab.cloud',
    tone: 'professional, urgent, technical',
  },
};

export function getTeamSignature(team) {
  return teamSignatures[team] || teamSignatures.support;
}

export function getTeamTone(team) {
  return teamSignatures[team]?.tone || 'professional';
}
