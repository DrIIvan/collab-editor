import { test as base } from '@playwright/test';

export const test = base.extend({
    page: async ({ page }, use) => {
        // Перед каждым тестом полностью очищаем всё хранилище
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.context().clearCookies();

        await use(page);
    },
});

export { expect } from '@playwright/test';