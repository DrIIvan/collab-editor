import { test, expect } from './fixtures';

test('создание документа по ссылке и ввод имени', async ({ page }) => {
    const docId = 'test-' + Date.now();
    await page.goto(`/d/${docId}`);

    const modal = page.locator('form');
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="text"]').fill('Алиса');
    await page.locator('button[type="submit"]').click();

    await expect(modal).toBeHidden();
    await expect(page.locator('h1')).toContainText(docId);
});