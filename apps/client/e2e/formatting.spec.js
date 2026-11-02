import { test, expect } from './fixtures';

async function enterAsUser(page, name, docId) {
    await page.goto(`/d/${docId}`);
    await page.locator('input[type="text"]').fill(name);
    await page.locator('button[type="submit"]').click();
}

test.describe('Форматирование текста', () => {
    test('должен применять жирное форматирование', async ({ page }) => {
        const docId = 'bold-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        const editor = page.locator('.tiptap[contenteditable="true"]');
        await expect(editor).toBeVisible();

        await editor.click();
        await page.keyboard.type('Тестовый текст');

        // Выделяем текст (Ctrl+A)
        await page.keyboard.press('Control+a');

        // Нажимаем кнопку жирного
        await page.getByRole('button', { name: 'Жирный (Ctrl+B)' }).click();

        // Проверяем что текст стал жирным
        const boldText = editor.locator('strong');
        await expect(boldText).toBeVisible();
        await expect(boldText).toContainText('Тестовый текст');
    });

    test('должен создавать маркированный список', async ({ page }) => {
        const docId = 'bullet-list-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        const editor = page.locator('.tiptap[contenteditable="true"]');
        await expect(editor).toBeVisible();

        await editor.click();
        await page.keyboard.type('Первый пункт');

        await page.getByRole('button', { name: 'Маркированный список' }).click();

        const list = editor.locator('ul');
        await expect(list).toBeVisible();
        await expect(list.locator('li')).toContainText('Первый пункт');
    });

    test('Undo/Redo должны работать', async ({ page }) => {
        const docId = 'undo-redo-' + Date.now();
        await enterAsUser(page, 'Тестер', docId);

        const editor = page.locator('.tiptap[contenteditable="true"]');
        await expect(editor).toBeVisible();

        await editor.click();
        await page.keyboard.type('Первый текст');

        await expect(editor).toContainText('Первый текст');

        // Undo
        await page.getByRole('button', { name: 'Отменить' }).click();
        await expect(editor).not.toContainText('Первый текст');

        // Redo
        await page.getByRole('button', { name: 'Повторить' }).click();
        await expect(editor).toContainText('Первый текст');
    });
});