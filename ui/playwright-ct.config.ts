import { defineConfig, devices } from '@playwright/experimental-ct-react'
import react from '@vitejs/plugin-react'

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.ct.{ts,tsx}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    permissions: ['microphone', 'camera'],
    ctPort: 3100,
    ctViteConfig: {
      plugins: [react()],
    },
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
