// src/network/invisibleGuide.js
// Invisible guide system — contextual micro-hints that feel like "figuring it out yourself"
// ULTRA PRECISE: zero spam, zero explanations, only next step
// NOT a chat. NOT AI-sounding. Minimal, contextual, non-invasive.

const GUIDE_RULES = {
  'lab-1-webdown': {
    idle_15s: {
      hint: 'Check service status',
      type: 'micro',
    },
    idle_25s: {
      hint: 'systemctl status httpd',
      type: 'command',
    },
    error_2: {
      hint: 'Then restart it',
      type: 'next-step',
    },
    partial_success: {
      hint: 'Service is down. Start it.',
      type: 'next-step',
    },
    success: {
      hint: 'Server fixed. You just solved a real issue.',
      type: 'reward',
    },
  },
  'lab-2-diskfull': {
    idle_15s: {
      hint: 'Check disk usage',
      type: 'micro',
    },
    idle_25s: {
      hint: 'df -h',
      type: 'command',
    },
    error_2: {
      hint: 'Logs are consuming all space',
      type: 'encouragement',
    },
    partial_success: {
      hint: 'Disk full. Clean journals.',
      type: 'next-step',
    },
    success: {
      hint: 'Disk recovered. Real production skill.',
      type: 'reward',
    },
  },
  'lab-3-security': {
    idle_15s: {
      hint: 'Check firewall status',
      type: 'micro',
    },
    idle_25s: {
      hint: 'systemctl status firewalld',
      type: 'command',
    },
    error_2: {
      hint: 'Firewall is down. Security risk.',
      type: 'encouragement',
    },
    partial_success: {
      hint: 'Firewall disabled. Enable it.',
      type: 'next-step',
    },
    success: {
      hint: 'Security hardened. Enterprise-level skill.',
      type: 'reward',
    },
  },
};

export class InvisibleGuide {
  constructor() {
    this.labId = null;
    this.commandHistory = [];
    this.errorCount = 0;
    this.successCount = 0;
    this.lastCommandTime = Date.now();
    this.hintsShown = {};
    this.idleTimers = {};
    this.onHint = null;
    this.userProfile = {
      success: 0,
      failures: 0,
      avgTime: 0,
      totalTime: 0,
    };
  }

  start(labId, onHint) {
    this.labId = labId;
    this.onHint = onHint;
    this.reset();
  }

  reset() {
    this.commandHistory = [];
    this.errorCount = 0;
    this.successCount = 0;
    this.lastCommandTime = Date.now();
    this.hintsShown = {};
    this.clearIdleTimers();
  }

  clearIdleTimers() {
    Object.values(this.idleTimers).forEach(t => clearTimeout(t));
    this.idleTimers = {};
  }

  recordCommand(command, success, errorMessage) {
    this.lastCommandTime = Date.now();
    this.commandHistory.push({ command, success, timestamp: Date.now() });

    if (success) {
      this.successCount++;
      this.userProfile.success++;
    } else {
      this.errorCount++;
      this.userProfile.failures++;
    }

    this.evaluateState();
  }

  evaluateState() {
    const rules = GUIDE_RULES[this.labId];
    if (!rules) return;

    const recentCommands = this.commandHistory.filter(c => Date.now() - c.timestamp < 60000);

    // Check for partial success (status check worked but fix not applied)
    if (!this.hintsShown['next-step']) {
      const hasStatusCheck = recentCommands.some(c => c.command.includes('status') && c.success);
      const noFixCommand = !recentCommands.some(c => c.command.includes('start') && c.success);

      if (hasStatusCheck && noFixCommand) {
        this.showHint(rules.partial_success, 'next-step');
        return;
      }
    }

    // After 2+ errors — precise next step
    if (!this.hintsShown['error_2'] && this.errorCount >= 2) {
      this.showHint(rules.error_2, 'error_2');
      return;
    }
  }

  showIdleHint() {
    const rules = GUIDE_RULES[this.labId];
    if (!rules) return;

    const timeSinceLastCommand = Date.now() - this.lastCommandTime;

    // 15s idle — micro hint
    if (timeSinceLastCommand >= 15000 && !this.hintsShown.micro) {
      this.showHint(rules.idle_15s, 'micro');
      this.scheduleIdleHint(25000, 'command');
    }
  }

  scheduleIdleHint(delayMs, type) {
    this.clearIdleTimers();
    this.idleTimers[type] = setTimeout(() => {
      const rules = GUIDE_RULES[this.labId];
      if (!rules || this.hintsShown[type]) return;
      const key = `idle_${Math.round(delayMs / 1000)}s`;
      this.showHint(rules[key], type);
    }, delayMs);
  }

  showHint(rule, type) {
    if (!rule || this.hintsShown[type]) return;

    this.hintsShown[type] = true;

    if (this.onHint) {
      this.onHint({
        hint: rule.hint,
        type: rule.type || type,
        labId: this.labId,
      });
    }
  }

  showReward() {
    const rules = GUIDE_RULES[this.labId];
    if (!rules || this.hintsShown.reward) return;
    this.showHint(rules.success, 'reward');
  }

  getUserProfile() {
    return this.userProfile;
  }

  stop() {
    this.clearIdleTimers();
    this.onHint = null;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const globalGuide = new InvisibleGuide();

export function getInvisibleGuide() {
  return globalGuide;
}
