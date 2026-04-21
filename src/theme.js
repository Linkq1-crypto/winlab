// theme.js — Jobs-Dark shared design tokens
// Import this in any component: import { t } from "./theme";

export const t = {
  // ── Page ───────────────────────────────────────────────────────────────────
  page:          "min-h-screen bg-black text-white",

  // ── Borders ────────────────────────────────────────────────────────────────
  border:        "border border-[#222]",
  borderSubtle:  "border border-[#1a1a1a]",

  // ── Typography ─────────────────────────────────────────────────────────────
  label:         "font-mono text-[10px] tracking-widest text-gray-600 uppercase block mb-2",
  section:       "font-mono text-[10px] tracking-[0.4em] text-gray-600 uppercase",
  muted:         "font-mono text-xs text-gray-600",
  tiny:          "font-mono text-[9px] text-gray-700 tracking-widest uppercase",

  // ── Error ───────────────────────────────────────────────────────────────────
  error:         "font-mono text-xs text-[#FF3B30] border-l-2 border-[#FF3B30] pl-4",

  // ── Form inputs ────────────────────────────────────────────────────────────
  input:         "w-full bg-black border border-[#222] px-4 py-3 font-mono text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#444] transition-colors duration-200",

  // ── Buttons ────────────────────────────────────────────────────────────────
  /** White-on-black primary CTA: full width */
  btnPrimary:    "w-full font-mono text-xs tracking-widest uppercase text-black bg-white py-3 hover:bg-gray-200 transition-colors duration-200 disabled:opacity-40",
  /** Bordered ghost — use for secondary actions */
  btnSecondary:  "font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-gray-300 border border-[#222] hover:border-[#444] px-4 py-2 transition-colors",
  /** Text-only ghost — nav, back links */
  btnGhost:      "font-mono text-[10px] tracking-widest uppercase text-gray-600 hover:text-white transition-colors",
  /** Danger — logout, destructive */
  btnDanger:     "font-mono text-[10px] tracking-widest uppercase text-gray-700 hover:text-[#FF3B30] transition-colors",

  // ── Containers ─────────────────────────────────────────────────────────────
  card:          "border border-[#222] bg-black",
  row:           "border-b border-[#1a1a1a]",

  // ── Color palette (raw values, for inline use) ──────────────────────────────
  colors: {
    black:       "#000000",
    surface:     "#050505",
    border:      "#222222",
    borderMuted: "#1a1a1a",
    red:         "#FF3B30",
    textPrimary: "#ffffff",
    textMuted:   "#6b7280",   // gray-500
    textFaint:   "#374151",   // gray-700
  },
};
