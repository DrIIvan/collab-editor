import { test, expect } from './fixtures';

async function enterAsUser(page, name, docId) {
    await page.goto(`/d/${docId}`);
    await page.locator('input[type="text"]').fill(name);
    await page.locator('button[type="submit"]').click();
}

test.describe('Навигация', () => {
    test('кнопка "Поделиться ссылкой" должна копировать URL', async ({ page, context }) => {
        const docId = 'copy-link-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        await expect(page.locator('.tiptap')).toBeVisible();

        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        page.on('dialog', async (dialog) => {
            expect(dialog.message()).toContain('Ссылка скопирована');
            await dialog.accept();
        });

        await page.getByRole('button', { name: 'Поделиться ссылкой' }).click();

        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText).toContain('/d/' + docId);
    });

    test('кнопка "Новый документ" должна перенаправлять', async ({ page }) => {
        const docId = 'new-doc-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        await expect(page.locator('.tiptap')).toBeVisible();

        const originalUrl = page.url();

        await page.getByRole('button', { name: 'Новый документ' }).click();

        await page.waitForURL(/\/d\/[a-z0-9]+/);

        const newUrl = page.url();
        expect(newUrl).not.toBe(originalUrl);
        expect(newUrl).toMatch(/\/d\/[a-z0-9]+/);
    });
});