import { test, expect } from '@playwright/test';

async function enterAsUser(page, name, docId) {
    await page.goto(`/d/${docId}`);
    // Ждём модалку перед fill
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="text"]').fill(name);
    await page.locator('button[type="submit"]').click();
}

test.describe('Импорт/Экспорт DOCX', () => {
    test('кнопки импорта и экспорта должны быть видны', async ({ page }) => {
        const docId = 'docx-buttons-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        await expect(page.locator('.tiptap')).toBeVisible();

        await expect(page.getByRole('button', { name: 'Импорт DOCX' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Экспорт DOCX' })).toBeVisible();
    });

    test('экспорт должен скачивать файл', async ({ page }) => {
        const docId = 'docx-download-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        const editor = page.locator('.tiptap[contenteditable="true"]');
        await expect(editor).toBeVisible();

        await editor.click();
        await page.keyboard.type('Тестовый документ');
        await page.waitForTimeout(500);

        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Экспорт DOCX' }).click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('.docx');
    });
});