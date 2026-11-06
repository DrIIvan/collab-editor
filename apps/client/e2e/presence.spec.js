import { test, expect } from './fixtures';

async function enterAsUser(page, name, docId) {
    await page.goto(`/d/${docId}`);
    await page.locator('input[type="text"]').fill(name);
    await page.locator('button[type="submit"]').click();
}

test('список участников виден всем', async ({ browser }) => {
    const docId = 'presence-' + Date.now();
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await enterAsUser(page1, 'Анна', docId);
    await expect(page1.getByText('Анна')).toBeVisible();

    await enterAsUser(page2, 'Вика', docId);

    // Оба должны видеть обоих участников
    await expect(page1.getByText('Анна')).toBeVisible();
    await expect(page1.getByText('Вика')).toBeVisible({ timeout: 5000 });
    await expect(page2.getByText('Анна')).toBeVisible({ timeout: 5000 });
    await expect(page2.getByText('Вика')).toBeVisible();

    await ctx1.close();
    await ctx2.close();
});