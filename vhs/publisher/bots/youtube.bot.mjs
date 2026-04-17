// YouTube publisher — YouTube Data API v3 (NOT Playwright — upload is too heavy)
// Docs: https://developers.google.com/youtube/v3/guides/uploading_a_video
import { google } from "googleapis";
import { existsSync, readFileSync, writeFileSync, createReadStream, statSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline";
import { log } from "../utils/logger.mjs";
import { YOUTUBE } from "../config.mjs";

const BASE = resolve(import.meta.dirname ?? ".", "..");

function getOAuth2Client() {
  return new google.auth.OAuth2(
    YOUTUBE.clientId,
    YOUTUBE.clientSecret,
    YOUTUBE.redirectUri
  );
}

export async function loginYouTube() {
  const oauth2 = getOAuth2Client();
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  log.info("[YT] Open this URL in your browser to authorize YouTube:");
  console.log("\n" + authUrl + "\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise(r => rl.question("Paste the authorization code: ", ans => { rl.close(); r(ans.trim()); }));

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const tokenFile = resolve(BASE, YOUTUBE.tokenFile);
  writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
  log.ok(`[YT] Token saved → ${tokenFile}`);
}

export async function publishYouTube({ title, description, tags = [], mediaPath, thumbnail }) {
  const tokenFile = resolve(BASE, YOUTUBE.tokenFile);
  if (!existsSync(tokenFile)) throw new Error("No YouTube token. Run: node login.mjs --platform youtube");

  const absMedia = resolve(BASE, "../output", mediaPath);
  if (!existsSync(absMedia)) throw new Error(`Media not found: ${absMedia}`);

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials(JSON.parse(readFileSync(tokenFile, "utf8")));

  // Auto-refresh token if expired
  oauth2.on("tokens", tokens => {
    if (tokens.refresh_token) {
      const current = JSON.parse(readFileSync(tokenFile, "utf8"));
      writeFileSync(tokenFile, JSON.stringify({ ...current, ...tokens }, null, 2));
    }
  });

  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const fileSize = statSync(absMedia).size;

  log.info(`[YT] Uploading: ${mediaPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId: "28",  // Science & Technology
        defaultLanguage: "en",
      },
      status: {
        privacyStatus: "public",   // "private" to review before going live
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(absMedia),
    },
  }, {
    onUploadProgress: evt => {
      const pct = Math.round((evt.bytesRead / fileSize) * 100);
      process.stdout.write(`\r[YT] Upload progress: ${pct}%`);
    },
  });

  console.log();  // newline after progress
  const videoId  = res.data.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  log.ok(`[YT] Published: ${videoUrl}`);

  // Upload thumbnail if provided
  if (thumbnail) {
    const absThumb = resolve(BASE, "../output", thumbnail);
    if (existsSync(absThumb)) {
      await youtube.thumbnails.set({
        videoId,
        media: { body: createReadStream(absThumb) },
      });
      log.ok("[YT] Thumbnail uploaded");
    }
  }

  return videoUrl;
}
