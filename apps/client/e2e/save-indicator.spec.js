import { test, expect } from './fixtures';

test('индикатор показывает Сохранено после синхронизации', async ({ page }) => {
    const docId = 'save-' + Date.now();
    await page.goto(`/d/${docId}`);
    await page.locator('input[type="text"]').fill('Тестер');
    await page.locator('button[type="submit"]').click();

    const editor = page.locator('.tiptap[contenteditable="true"]');
    await expect(editor).toBeVisible();

    // В начале индикатор должен показать "Сохранено" или "Синхронизация"
    const indicator = page.locator('text=Синхронизация').or(page.locator('text=Сохранено'));
    await expect(indicator).toBeVisible();

    // После печати и небольшой паузы должно быть "Сохранено"
    await editor.click();
    await page.keyboard.type('Тест сохранения');
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Сохранено')).toBeVisible({ timeout: 5000 });
});