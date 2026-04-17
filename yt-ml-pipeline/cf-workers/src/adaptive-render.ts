/**
 * Adaptive FFmpeg Renderer
 * Market-aware rendering with VHS effects, TTS sync, and regional optimizations
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { MarketConfig, getMarketConfig } from "./market-config";
import { getMarketVHSStyle, getVHSFilterString, VHS_EFFECTS } from "./vhs-library";

const FFMPEG_LOADED: { current: FFmpeg | null } = { current: null };

/**
 * Initialize FFmpeg WASM
 */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (FFMPEG_LOADED.current) return FFMPEG_LOADED.current;

  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await fetchFile(`${baseURL}/ffmpeg-core.js`),
    wasmURL: await fetchFile(`${baseURL}/ffmpeg-core.wasm`)
  });

  FFMPEG_LOADED.current = ffmpeg;
  return ffmpeg;
}

interface RenderOptions {
  videoUrl: string;
  subtitleContent: string;
  ttsAudioUrl?: string;
  market: "us" | "in" | "af";
  duration: number;
  vhsOverlayUrl?: string;
  bgmUrl?: string;
}

/**
 * Render video with market-aware adaptive settings
 */
export async function renderVideoAdaptive(options: RenderOptions): Promise<Uint8Array> {
  const ffmpeg = await loadFFmpeg();
  const { videoUrl, subtitleContent, ttsAudioUrl, market, duration, vhsOverlayUrl, bgmUrl } = options;

  const marketConfig = getMarketConfig(market);
  const vhsStyle = getMarketVHSStyle(market);

  console.log(`🎬 Rendering for ${market.toUpperCase()} (${duration}s)...`);

  // Download input video
  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile("input.mp4", videoData);

  // Write subtitle file
  await ffmpeg.writeFile("subtitles.ass", subtitleContent);

  // Build filter chain
  const filters = buildFilterChain(marketConfig, vhsStyle, vhsOverlayUrl !== undefined);

  // Build FFmpeg command
  const args = [
    "-i", "input.mp4",
    "-vf", `${filters},ass=subtitles.ass`,
    "-c:v", "libx264",
    "-profile:v", "main",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    "-crf", String(marketConfig.videoSettings.crf),
    "-s", marketConfig.videoSettings.resolution,
    "-t", String(duration),
    "-movflags", "+faststart"
  ];

  // Add TTS audio if provided
  if (ttsAudioUrl) {
    const ttsData = await fetchFile(ttsAudioUrl);
    await ffmpeg.writeFile("tts.mp3", ttsData);

    args.splice(6, 0, "-i", "tts.mp3");
    args.push("-c:a", "aac", "-b:a", "128k", "-map", "0:v:0", "-map", "1:a:0", "-shortest");
  }

  // Add background music if provided
  if (bgmUrl) {
    const bgmData = await fetchFile(bgmUrl);
    await ffmpeg.writeFile("bgm.mp3", bgmData);

    // Mix TTS + BGM
    args.push("-i", "bgm.mp3");
    args.push("-filter_complex", "[1:a]volume=0.3[bgm];[2:a][bgm]amix=inputs=2:duration=first[aout]");
    args.push("-map", "0:v:0", "-map", "[aout]");
  }

  args.push("-f", "mp4", "output.mp4");

  // Execute
  await ffmpeg.exec(args);

  // Read output
  const outputData = await ffmpeg.readFile("output.mp4");

  // Cleanup
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("subtitles.ass");
  if (ttsAudioUrl) await ffmpeg.deleteFile("tts.mp3");
  if (bgmUrl) await ffmpeg.deleteFile("bgm.mp3");
  await ffmpeg.deleteFile("output.mp4");

  console.log(`✅ Rendered: ${(outputData.length / 1024 / 1024).toFixed(2)} MB`);

  return outputData;
}

/**
 * Build adaptive filter chain based on market config
 */
function buildFilterChain(
  marketConfig: MarketConfig,
  vhsStyle: any,
  hasVHSOverlay: boolean
): string {
  const filters: string[] = [];

  // Base color grading
  const { warmth, saturation, intensity } = marketConfig.vhsOverlay;
  filters.push(`eq=brightness=${warmth}:saturation=${saturation}:contrast=${1.0 + intensity * 0.1}`);

  // VHS effects
  const vhsFilter = getVHSFilterString(vhsStyle);
  filters.push(vhsFilter);

  // Market-specific adjustments
  if (marketConfig.code === "af") {
    // Africa: slightly reduce file size
    filters.push("scale=720:1280");
  }

  return filters.join(",");
}

/**
 * Create TTS-synced subtitle timing
 */
export function generateSyncedSubtitles(
  text: string,
  ttsDuration: number,
  wordsPerScreen: number = 3
): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  const timePerWord = ttsDuration / totalWords;

  let ass = `[Script Info]
Title: Synced Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,50,50,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentTime = 0.5;

  for (let i = 0; i < words.length; i += wordsPerScreen) {
    const chunk = words.slice(i, i + wordsPerScreen);
    const endTime = currentTime + (timePerWord * chunk.length);

    const startFormatted = formatTime(currentTime);
    const endFormatted = formatTime(endTime);

    const text = chunk.join(" ")
      .replace(/\\/g, "\\\\")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}");

    ass += `Dialogue: 0,${startFormatted},${endFormatted},Default,,0,0,0,,{\\fad(100,100)}${text}\n`;

    currentTime = endTime - 0.05;
  }

  return ass;
}

/**
 * Format seconds to ASS time format
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Mix multiple audio tracks
 */
export async function mixAudio(
  tracks: Array<{ url: string; volume: number }>,
  duration: number
): Promise<Uint8Array> {
  const ffmpeg = await loadFFmpeg();

  // Download all audio tracks
  for (let i = 0; i < tracks.length; i++) {
    const data = await fetchFile(tracks[i].url);
    await ffmpeg.writeFile(`audio${i}.mp3`, data);
  }

  // Build complex filter for mixing
  const inputs = tracks.map((_, i) => `-i`).join(" ");
  const filterParts = tracks.map((t, i) => `[${i}:a]volume=${t.volume}[a${i}]`);
  const amix = tracks.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${tracks.length}:duration=first[out]`;

  const args = [
    ...tracks.flatMap((_, i) => [`-i`, `audio${i}.mp3`]),
    "-filter_complex",
    `${filterParts.join(";")};${amix}`,
    "-map", "[out]",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", String(duration),
    "-f", "mp3",
    "mixed.mp3"
  ];

  await ffmpeg.exec(args);

  const outputData = await ffmpeg.readFile("mixed.mp3");

  // Cleanup
  for (let i = 0; i < tracks.length; i++) {
    await ffmpeg.deleteFile(`audio${i}.mp3`);
  }
  await ffmpeg.deleteFile("mixed.mp3");

  return outputData;
}
