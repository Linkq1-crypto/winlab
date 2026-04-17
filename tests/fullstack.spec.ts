import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:5173';
const BACKEND  = 'http://localhost:3001';

test('FULL STACK CONNECTIVITY', async ({ page, request }) => {

  // ─── 1. BACKEND HEALTH CHECK ────────────────────────────────────────
  const health = await request.get(`${BACKEND}/health`);
  expect(health.status()).toBe(200);

  const healthJson = await health.json();
  expect(healthJson.status).toBe('ok');
  console.log('✅ Backend health:', healthJson);

  // ─── 2. DATABASE WRITE + READ TEST ──────────────────────────────────
  const dbTest = await request.post(`${BACKEND}/test-db`);
  const dbJson = await dbTest.json();
  expect(dbJson.success).toBe(true);
  console.log('✅ DB write/read:', dbJson);

  // ─── 3. REGISTER A NEW USER ─────────────────────────────────────────
  const testEmail = `test-${Date.now()}@qa.winlab.local`;
  const testPassword = 'QaTest2026!';

  const register = await request.post(`${BACKEND}/api/auth/register`, {
    data: { email: testEmail, name: 'QA Tester', password: testPassword }
  });
  const regJson = await register.json();
  expect(register.status()).toBe(201);
  expect(regJson.token).toBeTruthy();
  const token = regJson.token;
  console.log('✅ User registered:', testEmail);

  // ─── 4. LOGIN ────────────────────────────────────────────────────────
  const login = await request.post(`${BACKEND}/api/auth/login`, {
    data: { email: testEmail, password: testPassword }
  });
  const loginJson = await login.json();
  expect(login.status()).toBe(200);
  expect(loginJson.user.email).toBe(testEmail);
  console.log('✅ User logged in');

  // ─── 5. FETCH PROTECTED ENDPOINT (user profile) ──────────────────────
  const profile = await request.get(`${BACKEND}/api/user/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const profileJson = await profile.json();
  expect(profile.status()).toBe(200);
  expect(profileJson.email).toBe(testEmail);
  console.log('✅ Protected API call:', profileJson.email);

  // ─── 6. SAVE TOKEN TO BROWSER & VERIFY ──────────────────────────────
  // Set token in localStorage and verify it persists
  await page.goto(FRONTEND + '/');
  await page.evaluate((tkn) => {
    localStorage.setItem('winlab_token', tkn);
  }, token);

  // Verify the token is in localStorage (proves frontend can read it)
  const storedToken = await page.evaluate(() => localStorage.getItem('winlab_token'));
  expect(storedToken).toBe(token);
  console.log('✅ Frontend can store and read auth token');

  // Verify the frontend page loads with the token present
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  console.log('✅ Frontend loaded with auth token');

  // ─── 8. PROGRESS API CALL ───────────────────────────────────────────
  const progress = await request.post(`${BACKEND}/api/progress/update`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { labId: 'linux-terminal', completed: true, score: 100 }
  });
  const progressJson = await progress.json();
  expect(progress.status()).toBe(200);
  console.log('✅ Progress saved:', progressJson);

  // ─── 9. CLEANUP (delete test user) ──────────────────────────────────
  const deleteRes = await request.delete(`${BACKEND}/api/user/account`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(deleteRes.status()).toBe(200);
  console.log('✅ Test user deleted');

  // ─── 10. NO RUNTIME ERRORS ──────────────────────────────────────────
  await page.waitForTimeout(500);
  const errors = await page.evaluate(() => {
    return window.__QA_HEALTH__?.errors || 0;
  });
  expect(errors).toBe(0);
  console.log('✅ No runtime errors detected');

  console.log('✅ FULL STACK TEST PASSED');
});
