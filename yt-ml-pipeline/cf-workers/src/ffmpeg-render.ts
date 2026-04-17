/**
 * FFmpeg WASM Renderer for Cloudflare Workers
 * Handles 9:16 video rendering with subtitle burn-in and music mixing
 * 
 * ⚠️ Note: FFmpeg WASM is slow (~15-30s for 10s video)
 * For production scale, offload to Lambda/Render.com
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const FFMPEG_LOADED: { current: FFmpeg | null } = { current: null };

/**
 * Initialize FFmpeg WASM (call once per worker instance)
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (FFMPEG_LOADED.current) return FFMPEG_LOADED.current;

  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
  });

  FFMPEG_LOADED.current = ffmpeg;
  return ffmpeg;
}

interface RenderOptions {
  videoUrl: string;
  subtitleContent: string;
  musicUrl?: string;
  duration: number;
}

/**
 * Render 9:16 video with burned-in subtitles and optional music
 * @returns Video file as Uint8Array
 */
export async function renderVideo(options: RenderOptions): Promise<Uint8Array> {
  const ffmpeg = await loadFFmpeg();
  const { videoUrl, subtitleContent, musicUrl, duration } = options;

  console.log(`🎬 Rendering ${duration}s video with subtitles...`);

  // Download input video
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);

  // Write subtitle file
  await ffmpeg.writeFile("subtitles.ass", subtitleContent);

  // Build FFmpeg command with complex filter
  const args = [
    "-i", "input.mp4",
    "-vf", "ass=subtitles.ass",
    "-c:v", "libx264",
    "-profile:v", "main",
    "-preset", "ultrafast", // Fastest preset for WASM
    "-pix_fmt", "yuv420p",
    "-t", String(duration),
    "-movflags", "+faststart",
    "-f", "mp4",
    "output.mp4"
  ];

  // Add music if provided
  if (musicUrl) {
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile("music.mp3", musicData);

    // Insert music args before output
    args.splice(6, 0, "-i", "music.mp3", "-c:a", "aac", "-b:a", "128k", "-shortest");
  }

  // Execute
  await ffmpeg.exec(args);

  // Read output
  const outputData = await ffmpeg.readFile("output.mp4");

  // Cleanup
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("subtitles.ass");
  if (musicUrl) {
    await ffmpeg.deleteFile("music.mp3");
  }
  await ffmpeg.deleteFile("output.mp4");

  console.log(`✅ Rendered: ${(outputData.length / 1024 / 1024).toFixed(2)} MB`);

  return outputData;
}

/**
 * Concatenate multiple video clips
 */
export async function concatenateVideos(
  videoUrls: string[],
  musicUrl?: string
): Promise<Uint8Array> {
  const ffmpeg = await loadFFmpeg();

  console.log(`🎬 Concatenating ${videoUrls.length} clips...`);

  // Download all clips
  for (let i = 0; i < videoUrls.length; i++) {
    const data = await fetchFile(videoUrls[i]);
    await ffmpeg.writeFile(`clip${i}.mp4`, data);
  }

  // Create concat file
  const concatList = videoUrls.map((_, i) => `file 'clip${i}.mp4'`).join("\n");
  await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatList));

  const args = [
    "-f", "concat",
    "-safe", "0",
    "-i", "concat.txt",
    "-c", "copy",
    "-movflags", "+faststart",
    "output.mp4"
  ];

  if (musicUrl) {
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile("music.mp3", musicData);
    args.splice(8, 0, "-i", "music.mp3", "-c:a", "aac", "-b:a", "128k");
  }

  await ffmpeg.exec(args);

  const outputData = await ffmpeg.readFile("output.mp4");

  // Cleanup
  for (let i = 0; i < videoUrls.length; i++) {
    await ffmpeg.deleteFile(`clip${i}.mp4`);
  }
  await ffmpeg.deleteFile("concat.txt");
  await ffmpeg.deleteFile("output.mp4");

  return outputData;
}

/**
 * Add text overlay to video (simple, no ASS)
 */
export async function addTextOverlay(
  videoUrl: string,
  text: string,
  duration: number
): Promise<Uint8Array> {
  const ffmpeg = await loadFFmpeg();

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);

  const escapedText = text
    .replace(/:/g, "\\:")
    .replace(/'/g, "");

  const args = [
    "-i", "input.mp4",
    "-vf", `drawtext=text='${escapedText}':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=h*0.15:shadowcolor=black:shadowx=3:shadowy=3`,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    "-t", String(duration),
    "-f", "mp4",
    "output.mp4"
  ];

  await ffmpeg.exec(args);

  const outputData = await ffmpeg.readFile("output.mp4");

  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  return outputData;
}
