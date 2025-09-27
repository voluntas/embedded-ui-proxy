import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-tests',
  // 10秒のタイムアウト
  timeout: 10000,
  reporter: [['html', { open: 'never' }]],
  // リソース競合を避けるためワーカー数を制限
  workers: 2,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    // Chrome
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'pnpm vite --port 5174 --mode test',
    url: 'http://localhost:5174/',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
