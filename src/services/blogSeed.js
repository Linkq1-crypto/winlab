const MAIN_IMPORTED_BLOG_POSTS = [
  {
    slug: "the-art-of-the-rebuild",
    title: "The Art of the Rebuild",
    excerpt: "Why most RAID 5 recoveries fail and how to fix them.",
    content:
      "Most engineers only discover RAID's quirks when a disk fails at 2 AM. The parity math is sound, but the recovery process is full of operator traps: wrong rebuild order, silent read errors on a second disk, filesystem inconsistencies post-sync.\n\nIn this deep dive we walk through the main failure modes and how the WinLab RAID simulator prepares teams to handle each one inside an isolated incident environment.",
    tags: ["storage", "raid", "recovery"],
    status: "published",
    publishedAt: "2026-04-18T09:00:00.000Z",
  },
  {
    slug: "terraform-state-hell",
    title: "Terraform State Hell",
    excerpt: "Five scenarios that break infrastructure delivery and how WinLab trains them safely.",
    content:
      "State drift. Remote state locking deadlocks. Partial applies that leave infrastructure in an unknown condition. Import loops. Destroy cascades.\n\nIf you have not lived through at least three of these in production, you have probably not done enough Terraform. We built lab scenarios that simulate each one in a safe environment so teams can practice recovery before it matters.",
    tags: ["terraform", "infrastructure", "incident-readiness"],
    status: "published",
    publishedAt: "2026-04-22T09:00:00.000Z",
  },
  {
    slug: "vsphere-orchestration-in-2026",
    title: "vSphere Orchestration in 2026",
    excerpt: "Moving from GUI clicking to Infrastructure as Code.",
    content:
      "The vSphere Web Client is comfortable. It is also how teams end up with undocumented, unreproducible and untestable infrastructure.\n\nThe stronger pattern is the vSphere provider in Terraform plus GitOps controls. This note covers that migration path and shows how WinLab can be used to simulate drift detection and remediation under operational pressure.",
    tags: ["vsphere", "terraform", "gitops"],
    status: "published",
    publishedAt: "2026-04-25T09:00:00.000Z",
  },
];

export { MAIN_IMPORTED_BLOG_POSTS };

export async function ensureSeedBlogPosts(prisma, options = {}) {
  const { force = false, logger = console } = options;

  const existingCount = await prisma.blogPost.count();
  if (existingCount > 0 && !force) {
    return { imported: 0, skipped: MAIN_IMPORTED_BLOG_POSTS.length, existingCount };
  }

  let imported = 0;
  for (const post of MAIN_IMPORTED_BLOG_POSTS) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      create: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        tags: JSON.stringify(post.tags),
        status: post.status,
        publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
      },
      update: force
        ? {
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            tags: JSON.stringify(post.tags),
            status: post.status,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          }
        : {},
    });
    imported += 1;
  }

  logger.info?.(`[blogSeed] imported ${imported} post(s)`);
  return { imported, skipped: 0, existingCount };
}
