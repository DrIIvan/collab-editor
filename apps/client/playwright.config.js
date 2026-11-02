import { defineConfig, devices, expect } from '@playwright/test';

expect.configure({ timeout: 10000 });

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 60000,
    use: {
        baseURL: 'http://localhost:5174',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        actionTimeout: 10000,
        navigationTimeout: 15000,
        // ВАЖНО: каждый тест получает полностью чистый контекст
        storageState: undefined,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: [
        {
            command: 'npm run dev --workspace=apps/server',
            port: 1234,
            reuseExistingServer: !process.env.CI,
            cwd: '../..',
            timeout: 120000,
        },
        {
            command: 'npm run dev',
            port: 5174,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    ],
});