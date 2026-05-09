import { PrismaClient } from "@prisma/client";
import {
  PRODUCTION_SEO_SERIES_START_UTC,
  buildProductionSeoSeriesSchedule,
} from "../src/services/productionSeoSeries.js";

process.env.DATABASE_URL ||= "file:./prisma/dev.db";

const prisma = new PrismaClient();
const scheduledPosts = buildProductionSeoSeriesSchedule(PRODUCTION_SEO_SERIES_START_UTC);

try {
  for (const post of scheduledPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      create: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        tags: JSON.stringify(post.tags),
        status: post.status,
        publishedAt: new Date(post.publishedAt),
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: JSON.stringify(post.tags),
        status: post.status,
        publishedAt: new Date(post.publishedAt),
      },
    });
  }

  console.log(JSON.stringify({
    scheduled: scheduledPosts.length,
    startUtc: PRODUCTION_SEO_SERIES_START_UTC,
    firstSlug: scheduledPosts[0]?.slug || null,
    lastSlug: scheduledPosts[scheduledPosts.length - 1]?.slug || null,
    posts: scheduledPosts.map((post) => ({
      slug: post.slug,
      publishedAt: post.publishedAt,
    })),
  }, null, 2));
} catch (error) {
  console.error("[schedule-production-seo-series] failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
