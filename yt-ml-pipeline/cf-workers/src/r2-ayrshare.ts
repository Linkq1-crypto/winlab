/**
 * R2 Upload + Ayrshare Broadcast Handler
 * Handles final publishing pipeline
 */

interface PublishResult {
  jobId: string;
  r2Key: string;
  publicUrl: string;
  platforms: Record<string, { status: string; id?: string; error?: string }>;
}

/**
 * Upload video to R2 and generate public URL
 */
export async function uploadToR2(
  bucket: R2Bucket,
  videoData: ArrayBuffer | Uint8Array,
  jobId: string
): Promise<{ key: string; url: string }> {
  const key = `videos/${jobId}.mp4`;

  await bucket.put(key, videoData, {
    httpMetadata: { contentType: "video/mp4" },
    customMetadata: {
      jobId,
      createdAt: new Date().toISOString()
    }
  });

  // Public URL (assuming R2 public bucket or custom domain)
  const url = `https://pub-your-account.r2.dev/${key}`;

  console.log(`📤 Uploaded to R2: ${key}`);
  return { key, url };
}

/**
 * Broadcast to multiple platforms via Ayrshare
 */
export async function broadcastToAyrshare(
  videoUrl: string,
  metadata: {
    title: string;
    description?: string;
    tags?: string[];
    platforms: string[];
    scheduleDate?: string;
  },
  apiKey: string
): Promise<Record<string, { status: string; id?: string; error?: string }>> {
  const results: Record<string, { status: string; id?: string; error?: string }> = {};

  const requestBody: any = {
    mediaUrls: [videoUrl],
    platforms: metadata.platforms,
    title: metadata.title,
    description: metadata.description || `${metadata.title}\n\n#linux #devops #terminal #tech #tutorial`
  };

  if (metadata.tags) {
    requestBody.tags = metadata.tags;
  }

  if (metadata.scheduleDate) {
    requestBody.scheduleDate = metadata.scheduleDate;
  }

  try {
    const response = await fetch("https://app.ayrshare.com/api/post", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Ayrshare API error");
    }

    // Parse results per platform
    for (const platform of metadata.platforms) {
      results[platform] = {
        status: "success",
        id: data.id || data.postId
      };
    }

    console.log(`🚀 Broadcast successful: ${metadata.platforms.join(", ")}`);
  } catch (err) {
    console.error("❌ Broadcast failed:", err);
    for (const platform of metadata.platforms) {
      results[platform] = {
        status: "error",
        error: (err as Error).message
      };
    }
  }

  return results;
}

/**
 * Select random royalty-free music from R2
 */
export async function getRandomMusic(
  bucket: R2Bucket,
  musicPrefix: string = "music/"
): Promise<{ key: string; url: string } | null> {
  const listed = await bucket.list({ prefix: musicPrefix });

  if (listed.objects.length === 0) {
    console.warn("⚠️ No music files found in R2");
    return null;
  }

  // Select random track
  const randomIndex = Math.floor(Math.random() * listed.objects.length);
  const track = listed.objects[randomIndex];

  const url = `https://pub-your-account.r2.dev/${track.key}`;

  console.log(`🎵 Selected music: ${track.key}`);
  return { key: track.key, url };
}

/**
 * Get music metadata from R2
 */
export async function listAvailableMusic(bucket: R2Bucket, prefix: string = "music/") {
  const listed = await bucket.list({ prefix });

  return listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `https://pub-your-account.r2.dev/${obj.key}`
  }));
}

/**
 * Complete publish flow: R2 upload → Ayrshare broadcast
 */
export async function completePublish(
  bucket: R2Bucket,
  videoData: ArrayBuffer | Uint8Array,
  jobId: string,
  metadata: {
    title: string;
    description?: string;
    platforms: string[];
    scheduleDate?: string;
  },
  ayrshareApiKey: string
): Promise<PublishResult> {
  // Step 1: Upload to R2
  const { key: r2Key, url: publicUrl } = await uploadToR2(bucket, videoData, jobId);

  // Step 2: Broadcast to platforms
  const platforms = await broadcastToAyrshare(
    publicUrl,
    {
      title: metadata.title,
      description: metadata.description,
      platforms: metadata.platforms,
      scheduleDate: metadata.scheduleDate
    },
    ayrshareApiKey
  );

  return {
    jobId,
    r2Key,
    publicUrl,
    platforms
  };
}
