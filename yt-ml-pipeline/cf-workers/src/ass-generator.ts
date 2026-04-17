/**
 * ASS Subtitle Generator with Pop-in Animations
 * Creates dynamic subtitles for 9:16 vertical videos
 * Used with FFmpeg ass filter for burn-in
 */

interface SubtitleWord {
  text: string;
  start: number; // seconds
  end: number;   // seconds
}

interface ASSStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  shadowColor: string;
  alignment: number;
  marginV: number;
}

const DEFAULT_STYLE: ASSStyle = {
  fontName: "Arial",
  fontSize: 48,
  primaryColor: "&H00FFFFFF",
  outlineColor: "&H00000000",
  shadowColor: "&H80000000",
  alignment: 2, // Bottom center
  marginV: 150
};

/**
 * Generate ASS subtitle file with pop-in word-by-word animation
 * @param text - Full subtitle text
 * @param duration - Video duration in seconds
 * @param wordsPerScreen - Number of words visible at once
 * @returns ASS file content as string
 */
export function generateASSSubtitles(
  text: string,
  duration: number,
  wordsPerScreen: number = 3
): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  const timePerWord = (duration - 2) / totalWords; // Leave 2s padding

  const header = generateASSHeader();
  const style = generateStyleSection(DEFAULT_STYLE);
  const events = generateWordEvents(words, timePerWord, wordsPerScreen);

  return `${header}\n${style}\n${events}`;
}

/**
 * Generate ASS file header
 */
function generateASSHeader(): string {
  return `[Script Info]
Title: AI-Generated Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

`;
}

/**
 * Generate V4+ Styles section
 */
function generateStyleSection(style: ASSStyle): string {
  return `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${style.fontName},${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.shadowColor},1,0,0,0,100,100,0,0,1,3,2,${style.alignment},50,50,${style.marginV},1

`;
}

/**
 * Generate dialogue events with pop-in animation
 * Shows words in groups, with smooth transitions
 */
function generateWordEvents(
  words: string[],
  timePerWord: number,
  wordsPerScreen: number
): string {
  let events = "[Events]\n";
  events += "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  let currentTime = 1.0; // Start after 1s

  for (let i = 0; i < words.length; i += wordsPerScreen) {
    const chunk = words.slice(i, i + wordsPerScreen);
    const endTime = currentTime + (timePerWord * chunk.length);

    // Format time as H:MM:SS.cc
    const startFormatted = formatTime(currentTime);
    const endFormatted = formatTime(endTime);

    // Join words with space, escape ASS special chars
    const text = chunk.join(" ")
      .replace(/\\/g, "\\\\")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}");

    // Add pop-in effect using \fad (fade) and \move
    events += `Dialogue: 0,${startFormatted},${endFormatted},Default,,0,0,0,,{\\fad(100,100)}${text}\n`;

    currentTime = endTime - 0.1; // Small overlap for smoothness
  }

  return events;
}

/**
 * Format seconds to H:MM:SS.cc
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Generate highlighted subtitle with keyword emphasis
 * Highlights technical terms in different color
 */
export function generateHighlightedASS(
  text: string,
  duration: number,
  keywords: string[] = [],
  wordsPerScreen: number = 3
): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  const timePerWord = (duration - 2) / totalWords;

  let events = "[Events]\n";
  events += "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  let currentTime = 1.0;

  for (let i = 0; i < words.length; i += wordsPerScreen) {
    const chunk = words.slice(i, i + wordsPerScreen);
    const endTime = currentTime + (timePerWord * chunk.length);

    // Highlight keywords with color change
    const formattedText = chunk.map(word => {
      const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (keywords.some(kw => cleanWord.includes(kw.toLowerCase()))) {
        // Green highlight for keywords
        return `{\\c&H00FF00&}${word}{\\c&HFFFFFF&}`;
      }
      return word;
    }).join(" ")
      .replace(/\\\\/g, "\\")
      .replace(/\\{/g, "\\{")
      .replace(/\\}/g, "\\}");

    const startFormatted = formatTime(currentTime);
    const endFormatted = formatTime(endTime);

    events += `Dialogue: 0,${startFormatted},${endFormatted},Default,,0,0,0,,{\\fad(100,100)}${formattedText}\n`;

    currentTime = endTime - 0.1;
  }

  const header = generateASSHeader();
  const style = generateStyleSection(DEFAULT_STYLE);

  return `${header}\n${style}\n${events}`;
}
