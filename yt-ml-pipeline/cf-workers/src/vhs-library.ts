/**
 * VHS Library Integration
 * Handles VHS overlay effects from lab library
 * Supports: scanlines, glitch, color bleeding, tracking errors
 */

export interface VHSEffect {
  name: string;
  file: string;
  blendMode: string;
  opacity: number;
}

export interface VHSStyle {
  scanlines: boolean;
  glitch: boolean;
  colorBleed: boolean;
  tracking: boolean;
  warmth: number;
  saturation: number;
  contrast: number;
  brightness: number;
}

// VHS effect presets for different markets
export const VHS_EFFECTS: Record<string, VHSEffect> = {
  subtle: {
    name: "Subtle VHS",
    file: "vhs/vhs_scanlines.png",
    blendMode: "overlay",
    opacity: 0.25
  },
  vibrant: {
    name: "Vibrant Retro",
    file: "vhs/vhs_colorful.png",
    blendMode: "overlay",
    opacity: 0.35
  },
  warm: {
    name: "Warm Nostalgic",
    file: "vhs/vhs_warm.png",
    blendMode: "softlight",
    opacity: 0.3
  }
};

/**
 * Get FFmpeg filter string for VHS effect
 */
export function getVHSFilterString(
  style: VHSStyle,
  resolution: string = "1080x1920"
): string {
  const filters: string[] = [];

  // Base color grading
  filters.push(
    `eq=brightness=${style.brightness}:saturation=${style.saturation}:contrast=${style.contrast}`
  );

  if (style.scanlines) {
    // Simulate scanlines
    filters.push("format=yuv444p");
    filters.push(
      `geq=r='if(gt(mod(Y,2),0),p(X,Y),p(X,Y)*0.8)':` +
      `g='if(gt(mod(Y,2),0),p(X,Y),p(X,Y)*0.8)':` +
      `b='if(gt(mod(Y,2),0),p(X,Y),p(X,Y)*0.8)'`
    );
  }

  if (style.glitch) {
    // Subtle horizontal glitch
    filters.push("hqdn3d=2:2:3:3");
  }

  if (style.colorBleed) {
    // Chromatic aberration simulation
    filters.push("chromakey=0x00FF00:0.1:0.2");
  }

  if (style.tracking) {
    // Tracking error simulation (subtle)
    filters.push("noise=alls=10:allf=t+u");
  }

  return filters.join(",");
}

/**
 * Get FFmpeg complex filter for VHS overlay blend
 */
export function getVHSOverlayFilter(
  overlayFile: string,
  opacity: number,
  blendMode: string
): string {
  return `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[overlay];` +
    `[0:v][overlay]blend=all_mode=${blendMode}:all_opacity=${opacity}[vhs_out]`;
}

/**
 * Get market-appropriate VHS style
 */
export function getMarketVHSStyle(market: "us" | "in" | "af"): VHSStyle {
  const styles: Record<string, VHSStyle> = {
    us: {
      scanlines: true,
      glitch: false,
      colorBleed: false,
      tracking: false,
      warmth: 0.1,
      saturation: 1.0,
      contrast: 1.05,
      brightness: 0.0
    },
    in: {
      scanlines: true,
      glitch: true,
      colorBleed: false,
      tracking: false,
      warmth: 0.3,
      saturation: 1.3,
      contrast: 1.1,
      brightness: 0.02
    },
    af: {
      scanlines: true,
      glitch: false,
      colorBleed: true,
      tracking: true,
      warmth: 0.4,
      saturation: 1.2,
      contrast: 1.08,
      brightness: 0.03
    }
  };

  return styles[market];
}

/**
 * Get VHS overlay file path from R2
 */
export function getVHSOverlayPath(market: "us" | "in" | "af"): string {
  const effect = market === "us" ? "subtle" : market === "in" ? "vibrant" : "warm";
  return VHS_EFFECTS[effect].file;
}

/**
 * Generate complete VHS filter chain for FFmpeg
 */
export function generateVHSFilterChain(
  market: "us" | "in" | "af",
  hasOverlay: boolean = false
): string {
  const style = getMarketVHSStyle(market);
  const baseFilter = getVHSFilterString(style);

  if (!hasOverlay) {
    return baseFilter;
  }

  const overlayFile = getVHSOverlayPath(market);
  const effect = VHS_EFFECTS[market === "us" ? "subtle" : market === "in" ? "vibrant" : "warm"];

  return (
    `[0:v]${baseFilter}[base];` +
    `[1:v]format=rgba,colorchannelmixer=aa=${effect.opacity}[overlay];` +
    `[base][overlay]blend=all_mode=${effect.blendMode}:all_opacity=${effect.opacity}[vhs_out]`
  );
}

/**
 * List available VHS assets in R2
 */
export async function listVHSAssets(bucket: R2Bucket): Promise<string[]> {
  try {
    const listed = await bucket.list({ prefix: "vhs/" });
    return listed.objects.map(obj => obj.key);
  } catch {
    return [];
  }
}

/**
 * Get random VHS overlay from R2
 */
export async function getRandomVHSOverlay(bucket: R2Bucket): Promise<string | null> {
  const assets = await listVHSAssets(bucket);
  if (assets.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * assets.length);
  return assets[randomIndex];
}
