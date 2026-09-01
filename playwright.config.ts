import { defineConfig, devices } from "@playwright/test";

const MOCK_SUPABASE_PORT = 54321;
const APP_PORT = 3100;

/** Set locally to reuse a preinstalled Chromium instead of downloading one. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "on-first-retry",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    // The board is phone-first — test it at phone size.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node --experimental-strip-types tests/support/mock-supabase.ts",
      port: MOCK_SUPABASE_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
    },
    {
      // Tested against a production build, not `next dev`: dev mode blocks
      // cross-origin dev resources, so nothing hydrates under test — and the
      // build is what actually ships.
      command: `npx next build && npx next start --port ${APP_PORT}`,
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
        VACANCY_LINK_CODE: "e2e-test-code-0123456789abcdef",
      },
    },
  ],
});
