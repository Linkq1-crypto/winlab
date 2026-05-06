import { PrismaClient } from "@prisma/client";
import { ensureSeedBlogPosts } from "../src/services/blogSeed.js";

process.env.DATABASE_URL ||= "file:./prisma/dev.db";

const prisma = new PrismaClient();

try {
  const result = await ensureSeedBlogPosts(prisma, { force: true });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("[import-main-blog-posts] failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
