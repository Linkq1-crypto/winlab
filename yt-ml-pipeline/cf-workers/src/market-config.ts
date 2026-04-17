/**
 * Market-Aware Configuration
 * Adaptive pipeline for USA, India, and Africa targets
 * Supports local languages: Hindi, Swahili, Yoruba
 */

export type MarketCode = "us" | "in" | "af";
export type LanguageCode = "en" | "hi" | "sw" | "yo";

export interface MarketConfig {
  code: MarketCode;
  name: string;
  timezone: string;
  language: string;
  localLanguages: LanguageCode[]; // Hindi, Swahili, Yoruba etc
  voiceId: string;
  voiceSettings: {
    stability: number;
    similarity: number;
    style: number;
  };
  bgmStyle: string;
  vhsOverlay: {
    intensity: number;
    warmth: number;
    saturation: number;
  };
  subtitleFont: string;
  subtitleSize: number;
  subtitlePosition: number;
  platforms: string[];
  optimalPostTimes: string[];
  videoSettings: {
    resolution: string;
    crf: number;
    bitrate: string;
  };
  promptAugmentation: string;
  costPerVideo: number;
  telegramLanguage: string;
}

// Language-specific font mappings for FFmpeg WASM
export const LANGUAGE_FONTS: Record<LanguageCode, string> = {
  en: "Arial",
  hi: "NotoSansDevanagari",
  sw: "Arial",
  yo: "Arial"
};

// ElevenLabs voice mappings for local languages
export const LANGUAGE_VOICES: Record<LanguageCode, string> = {
  en: "EXAVITQu4vr4xnSDxMaL", // Rachel
  hi: "VR6AewLTigWG4xSOukaG", // Arnold (good for Hindi-English)
  sw: "TxGEqnHWrfWFTfGW9XjX", // Adam (versatile for African languages)
  yo: "TxGEqnHWrfWFTfGW9XjX"  // Adam
};

const MARKET_CONFIGS: Record<MarketCode, MarketConfig> = {
  us: {
    code: "us",
    name: "United States",
    timezone: "America/New_York",
    language: "en-US",
    localLanguages: ["en"],
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    voiceSettings: {
      stability: 0.5,
      similarity: 0.75,
      style: 0.0
    },
    bgmStyle: "lofi-electronic",
    vhsOverlay: {
      intensity: 0.25,
      warmth: 0.1,
      saturation: 1.0
    },
    subtitleFont: "Arial",
    subtitleSize: 48,
    subtitlePosition: 150,
    platforms: ["youtube", "twitter", "instagram"],
    optimalPostTimes: ["12:00", "18:00", "21:00"],
    videoSettings: {
      resolution: "1080x1920",
      crf: 23,
      bitrate: "4000k"
    },
    promptAugmentation: "professional linux tutorial, clear commands, devops style",
    costPerVideo: 0.13,
    telegramLanguage: "en"
  },

  in: {
    code: "in",
    name: "India",
    timezone: "Asia/Kolkata",
    language: "en-IN",
    localLanguages: ["en", "hi"],
    voiceId: "VR6AewLTigWG4xSOukaG",
    voiceSettings: {
      stability: 0.6,
      similarity: 0.7,
      style: 0.2
    },
    bgmStyle: "bollywood-fusion",
    vhsOverlay: {
      intensity: 0.35,
      warmth: 0.3,
      saturation: 1.3
    },
    subtitleFont: "NotoSansDevanagari",
    subtitleSize: 50,
    subtitlePosition: 140,
    platforms: ["instagram", "youtube", "facebook"],
    optimalPostTimes: ["09:00", "14:00", "20:00"],
    videoSettings: {
      resolution: "1080x1920",
      crf: 24,
      bitrate: "3500k"
    },
    promptAugmentation: "linux tutorial for beginners, step by step, clear explanation",
    costPerVideo: 0.09,
    telegramLanguage: "en"
  },

  af: {
    code: "af",
    name: "Africa",
    timezone: "Africa/Lagos",
    language: "en-NG",
    localLanguages: ["en", "sw", "yo"],
    voiceId: "TxGEqnHWrfWFTfGW9XjX",
    voiceSettings: {
      stability: 0.4,
      similarity: 0.6,
      style: 0.3
    },
    bgmStyle: "afrobeats-acoustic",
    vhsOverlay: {
      intensity: 0.3,
      warmth: 0.4,
      saturation: 1.2
    },
    subtitleFont: "Arial",
    subtitleSize: 52,
    subtitlePosition: 130,
    platforms: ["facebook", "instagram", "tiktok"],
    optimalPostTimes: ["10:00", "16:00", "19:00"],
    videoSettings: {
      resolution: "720x1280",
      crf: 26,
      bitrate: "2000k"
    },
    promptAugmentation: "basic linux commands, easy tutorial, server management",
    costPerVideo: 0.07,
    telegramLanguage: "en"
  }
};

export function getMarketConfig(market: MarketCode): MarketConfig {
  return MARKET_CONFIGS[market];
}

export function getAvailableMarkets(): MarketCode[] {
  return ["us", "in", "af"];
}

export function getAvailableLanguages(market: MarketCode): LanguageCode[] {
  return MARKET_CONFIGS[market].localLanguages;
}

export function getFontForLanguage(lang: LanguageCode): string {
  return LANGUAGE_FONTS[lang];
}

export function getVoiceForLanguage(lang: LanguageCode): string {
  return LANGUAGE_VOICES[lang];
}

export function getNextOptimalPostTime(market: MarketCode): Date {
  const config = getMarketConfig(market);
  const now = new Date();
  const marketTimeStr = now.toLocaleString("en-US", { timeZone: config.timezone });
  const marketTime = new Date(marketTimeStr);
  const today = marketTime.toDateString();
  
  const optimalTimes = config.optimalPostTimes.map(t => {
    const [hours, minutes] = t.split(":").map(Number);
    return new Date(`${today} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  });
  
  const futureTimes = optimalTimes.filter(t => t > marketTime);
  
  if (futureTimes.length > 0) {
    const nextTime = futureTimes[0];
    return new Date(nextTime.getTime() + (now.getTime() - marketTime.getTime()));
  }
  
  const tomorrow = new Date(optimalTimes[0]);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Date(tomorrow.getTime() + (now.getTime() - marketTime.getTime()));
}

export function getBGMPrefix(market: MarketCode): string {
  const config = getMarketConfig(market);
  return `music/${config.bgmStyle}/`;
}

export function getVHSOverlayFile(market: MarketCode): string {
  const config = getMarketConfig(market);
  const intensity = config.vhsOverlay.intensity >= 0.3 ? "vibrant" : "subtle";
  return `vhs/${intensity}_overlay.png`;
}

export function calculateMarketCost(market: MarketCode, videoCount: number): number {
  return getMarketConfig(market).costPerVideo * videoCount;
}

export function getPlatformPriority(market: MarketCode): string[] {
  return getMarketConfig(market).platforms;
}

export function getTTSSettings(market: MarketCode, lang?: LanguageCode) {
  const config = getMarketConfig(market);
  const voiceLang = lang || config.localLanguages[0];
  
  return {
    voiceId: getVoiceForLanguage(voiceLang),
    language: voiceLang,
    font: getFontForLanguage(voiceLang),
    stability: config.voiceSettings.stability,
    similarity: config.voiceSettings.similarity,
    style: config.voiceSettings.style
  };
}

export function getVideoSettings(market: MarketCode) {
  return getMarketConfig(market).videoSettings;
}

export function augmentPrompt(basePrompt: string, market: MarketCode): string {
  const config = getMarketConfig(market);
  return `${basePrompt}, ${config.promptAugmentation}`;
}
