// Anti-ban human simulation utilities

export async function humanDelay(min = 1200, max = 4500) {
  const ms = Math.random() * (max - min) + min;
  return new Promise(r => setTimeout(r, ms));
}

export async function shortDelay() {
  return humanDelay(300, 900);
}

export async function typingDelay(text) {
  // Simulate typing speed: 60-120 WPM → ~100-200ms per char
  const ms = text.length * (Math.random() * 100 + 100);
  return new Promise(r => setTimeout(r, Math.min(ms, 4000)));
}

// Type character by character into a field (more human-like than .fill)
export async function humanType(page, selector, text) {
  await page.click(selector);
  await shortDelay();
  for (const char of text) {
    await page.keyboard.type(char);
    await new Promise(r => setTimeout(r, Math.random() * 120 + 40));
  }
}

// Random mouse wiggle before clicking (defeats basic bot detection)
export async function humanClick(page, selector) {
  const el = await page.locator(selector).first();
  const box = await el.boundingBox();
  if (box) {
    const x = box.x + box.width * (0.3 + Math.random() * 0.4);
    const y = box.y + box.height * (0.3 + Math.random() * 0.4);
    await page.mouse.move(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
    await shortDelay();
    await page.mouse.click(x, y);
  } else {
    await el.click();
  }
}

// Mobile device emulation config (Instagram/TikTok need this)
export const MOBILE_CONTEXT = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "it-IT",
  timezoneId: "Europe/Rome",
};

export const DESKTOP_CONTEXT = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  viewport: { width: 1366, height: 768 },
  locale: "it-IT",
  timezoneId: "Europe/Rome",
};
