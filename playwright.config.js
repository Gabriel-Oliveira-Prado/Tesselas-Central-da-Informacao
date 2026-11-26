import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, viewport: { width: 420, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/dev-server.mjs', url: 'http://127.0.0.1:4173/extension/panel.html', reuseExistingServer: !process.env.CI },
});
