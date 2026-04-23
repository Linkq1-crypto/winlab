export const LEVELS = {
  NOVICE: {
    id: "NOVICE",
    label: "Novice",
    description: "Guided. Learn by doing.",
    difficulty: 1,
    hintsEnabled: true,
    hintFrequency: 30,
    noiseLevel: 0.1,
    logClarity: 0.9,
    ai: {
      allowReview: true,
      allowPatch: true,
      verbosity: "high",
      explainDepth: "step_by_step",
    },
    verify: {
      strict: false,
      allowPartial: true,
    },
    scoring: {
      base: 100,
      penaltyPerAttempt: 5,
      timeWeight: 0.2,
      bonusFirstTry: 20,
      bonusNoAI: 10,
    },
  },

  JUNIOR: {
    id: "JUNIOR",
    label: "Junior",
    description: "Assisted incident response.",
    difficulty: 2,
    hintsEnabled: true,
    hintFrequency: 60,
    noiseLevel: 0.2,
    logClarity: 0.8,
    ai: {
      allowReview: true,
      allowPatch: true,
      verbosity: "medium",
      explainDepth: "focused",
    },
    verify: {
      strict: false,
      allowPartial: false,
    },
    scoring: {
      base: 100,
      penaltyPerAttempt: 10,
      timeWeight: 0.3,
      bonusFirstTry: 15,
      bonusNoAI: 20,
    },
  },

  MID: {
    id: "MID",
    label: "Mid",
    description: "Less guidance, stricter validation.",
    difficulty: 3,
    hintsEnabled: false,
    hintFrequency: 0,
    noiseLevel: 0.4,
    logClarity: 0.6,
    ai: {
      allowReview: true,
      allowPatch: true,
      verbosity: "low",
      explainDepth: "minimal",
    },
    verify: {
      strict: true,
      allowPartial: false,
    },
    scoring: {
      base: 100,
      penaltyPerAttempt: 15,
      timeWeight: 0.5,
      bonusFirstTry: 25,
      bonusNoAI: 30,
    },
  },

  SENIOR: {
    id: "SENIOR",
    label: "Senior",
    description: "Production-like. Review only.",
    difficulty: 4,
    hintsEnabled: false,
    hintFrequency: 0,
    noiseLevel: 0.7,
    logClarity: 0.4,
    ai: {
      allowReview: true,
      allowPatch: false,
      verbosity: "low",
      explainDepth: "none",
    },
    verify: {
      strict: true,
      allowPartial: false,
    },
    scoring: {
      base: 100,
      penaltyPerAttempt: 20,
      timeWeight: 0.7,
      bonusFirstTry: 40,
      bonusNoAI: 50,
    },
  },

  SRE: {
    id: "SRE",
    label: "SRE",
    description: "No AI. Strict checks. Full pressure.",
    difficulty: 5,
    hintsEnabled: false,
    hintFrequency: 0,
    noiseLevel: 1.0,
    logClarity: 0.3,
    ai: {
      allowReview: false,
      allowPatch: false,
      verbosity: "none",
      explainDepth: "none",
    },
    verify: {
      strict: true,
      allowPartial: false,
    },
    scoring: {
      base: 100,
      penaltyPerAttempt: 25,
      timeWeight: 1.0,
      bonusFirstTry: 60,
      bonusNoAI: 80,
    },
  },
};

export const LEVEL_OPTIONS = Object.keys(LEVELS);

export function getLevelConfig(levelId) {
  return LEVELS[String(levelId || "JUNIOR").toUpperCase()] || LEVELS.JUNIOR;
}

export function isKnownLevel(levelId) {
  return Boolean(LEVELS[String(levelId || "").toUpperCase()]);
}

export default { LEVELS, LEVEL_OPTIONS, getLevelConfig, isKnownLevel };
