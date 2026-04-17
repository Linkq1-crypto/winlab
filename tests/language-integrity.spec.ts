import { test, expect, Page } from '@playwright/test'
import { detectLanguage, detectMixedLanguage, normalizeText } from './utils/language'

// Helper: estrae solo testo UI visibile (esclude terminale/code)
async function getVisibleUIText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    )

    let text = ''

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const el = node.parentElement

      if (!el) continue

      // ESCLUSIONI CRITICHE
      if (
        el.closest('[role="log"]') ||
        el.closest('.font-mono') ||
        el.closest('code') ||
        el.closest('pre')
      ) {
        continue
      }

      text += ' ' + node.textContent
    }

    return text
  })
}

test.describe('Language Integrity — Global EN enforcement', () => {

  const pages = [
    '/',
    '/intune',
    '/pricing',
    '/cert',
    '/community',
    '/auth'
  ]

  for (const path of pages) {
    test(`Page ${path} must be English`, async ({ page }) => {
      await page.goto(path)

      const bodyText = await page.locator('body').innerText()
      const clean = normalizeText(bodyText)

      const lang = detectLanguage(clean)

      expect(lang, `Detected language: ${lang}`).toBe('en')
    })
  }
})

test.describe('Mixed Language Detection', () => {
  test('No mixed language in UI', async ({ page }) => {
    await page.goto('/')

    const text = await page.locator('body').innerText()

    expect(detectMixedLanguage(text)).toBe(false)
  })
})

test.describe('Character Set Guards', () => {
  test('No unexpected unicode (European diacritics)', async ({ page }) => {
    await page.goto('/')

    const text = await page.locator('body').innerText()

    const forbidden = /[\u00C0-\u00FF]/ // à è ì ò ù ñ ü ecc

    expect(forbidden.test(text)).toBe(false)
  })

  test('No Devanagari script anywhere', async ({ page }) => {
    await page.goto('/')

    const text = await page.locator('body').innerText()

    const devanagari = /[\u0900-\u097F]/

    expect(devanagari.test(text)).toBe(false)
  })
})

test.describe('Terminology Consistency', () => {
  test('Terminology consistency', async ({ page }) => {
    await page.goto('/')

    const text = await page.locator('body').innerText()

    // vieta sinonimi non desiderati
    expect(text).not.toMatch(/\b(Exercise|Task)\b/)

    // forza termini ufficiali
    expect(text).toMatch(/\b(Scenario|Lab)\b/)
  })
})

test.describe('Lab UI Language (excluding terminal)', () => {
  test('Lab UI must be English (excluding terminal)', async ({ page }) => {
    await page.goto('/intune')

    const text = await getVisibleUIText(page)

    expect(text).not.toMatch(/\b(Scegli|Avanzati|Scenari)\b/)
  })
})

test.describe('Snapshot Tests', () => {
  test('UI text snapshot (anti-regression)', async ({ page }) => {
    await page.goto('/')

    const text = await page.locator('body').innerText()

    expect(text).toMatchSnapshot()
  })
})
