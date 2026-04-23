export const LABS = Object.freeze([
  Object.freeze({
    slug: "nginx-down",
    title: "Nginx Down",
    description: "Restore a failed edge service before user traffic fully drops.",
    durationMin: 12,
    difficulty: "junior",
    tier: "free",
    rating: 4.8,
  }),
  Object.freeze({
    slug: "api-timeout",
    title: "API Timeout",
    description: "Trace the timeout chain, isolate the bottleneck, and restore traffic.",
    durationMin: 18,
    difficulty: "junior",
    tier: "free",
    rating: 4.8,
  }),
  Object.freeze({
    slug: "nginx-port-conflict",
    title: "Nginx Port Conflict",
    description: "Recover a broken edge service when the listener cannot bind cleanly.",
    durationMin: 14,
    difficulty: "mid",
    tier: "free",
    rating: 4.7,
  }),
  Object.freeze({
    slug: "permission-denied",
    title: "Permission Denied",
    description: "Fix a production write path that fails under real file permissions.",
    durationMin: 16,
    difficulty: "mid",
    tier: "pro",
    rating: 4.9,
  }),
]);

export const PUBLIC_HOME_PAYLOAD = Object.freeze({
  stats: Object.freeze({
    engineers: 12000,
    countries: 120,
    labs: 24,
    avgRating: 4.8,
  }),
  featuredLabs: LABS,
  pricing: Object.freeze({
    freeLabs: 5,
    proMonthlyUsd: 19,
    currency: "USD",
  }),
  socialProof: Object.freeze({
    headline: "Joined by engineers from 120+ countries",
  }),
});

export const MOCK_PROGRESS = Object.freeze({
  completedLabs: 7,
  activeIncidents: 1,
  certificates: 2,
  currentStreakDays: 5,
  recentLabs: Object.freeze([
    Object.freeze({
      slug: "nginx-down",
      title: "Nginx Down",
      completedAt: "2026-04-23T08:30:00.000Z",
    }),
    Object.freeze({
      slug: "api-timeout",
      title: "API Timeout",
      completedAt: "2026-04-22T20:15:00.000Z",
    }),
    Object.freeze({
      slug: "nginx-port-conflict",
      title: "Nginx Port Conflict",
      completedAt: "2026-04-21T18:42:00.000Z",
    }),
    Object.freeze({
      slug: "permission-denied",
      title: "Permission Denied",
      completedAt: "2026-04-20T16:10:00.000Z",
    }),
  ]),
});
