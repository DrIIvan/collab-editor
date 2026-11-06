import { test, expect } from './fixtures';

async function enterAsUser(page, name, docId) {
    await page.goto(`/d/${docId}`);
    await page.locator('input[type="text"]').fill(name);
    await page.locator('button[type="submit"]').click();
}

test.describe('Коллаборативная синхронизация', () => {
    test('два пользователя видят изменения друг друга', async ({ browser }) => {
        const docId = 'sync-' + Date.now();

        const alice = await browser.newContext();
        const bob = await browser.newContext();
        const pageA = await alice.newPage();
        const pageB = await bob.newPage();

        await enterAsUser(pageA, 'Алиса', docId);
        await enterAsUser(pageB, 'Борис', docId);

        const editorA = pageA.locator('.tiptap[contenteditable="true"]');
        const editorB = pageB.locator('.tiptap[contenteditable="true"]');
        await expect(editorA).toBeVisible();
        await expect(editorB).toBeVisible();

        // Алиса пишет
        await editorA.click();
        await pageA.keyboard.type('Привет, ');
        await expect(editorB).toContainText('Привет,', { timeout: 5000 });

        // Борис продолжает
        await editorB.click();
        await pageB.keyboard.type('мир!');
        await expect(editorA).toContainText('Привет, мир!', { timeout: 5000 });

        await alice.close();
        await bob.close();
    });

    test('конкурентное редактирование одного абзаца', async ({ browser }) => {
        const docId = 'concurrent-' + Date.now();

        const ctx1 = await browser.newContext();
        const ctx2 = await browser.newContext();
        const page1 = await ctx1.newPage();
        const page2 = await ctx2.newPage();

        await enterAsUser(page1, 'Анна', docId);
        await enterAsUser(page2, 'Борис', docId);

        const editor1 = page1.locator('.tiptap[contenteditable="true"]');
        const editor2 = page2.locator('.tiptap[contenteditable="true"]');
        await expect(editor1).toBeVisible();
        await expect(editor2).toBeVisible();

        // Анна пишет базовый текст
        await editor1.click();
        await page1.keyboard.type('Тестовый текст');

        // ВАЖНО: ждём, пока базовый текст дойдёт до Бориса
        await expect(editor2).toContainText('Тестовый текст', { timeout: 10000 });

        // ОБА КЛИКАЮТ в свои редакторы и ставят курсор в конец ПОСЛЕДОВАТЕЛЬНО
        // (иначе у Бориса курсор может быть в начале документа)
        await editor1.click();
        await page1.keyboard.press('End');

        await editor2.click();
        await page2.keyboard.press('End');

        // ВОТ СЮДА встраиваем Promise.all — реальная параллельность
        await Promise.all([
            page1.keyboard.type(' A'),
            page2.keyboard.type(' B'),
        ]);

        // Проверяем что оба видят оба символа
        await expect(editor1).toContainText('A', { timeout: 10000 });
        await expect(editor1).toContainText('B', { timeout: 10000 });
        await expect(editor2).toContainText('A', { timeout: 10000 });
        await expect(editor2).toContainText('B', { timeout: 10000 });

        await ctx1.close();
        await ctx2.close();
    });

    test('новый участник получает актуальную версию', async ({ browser }) => {
        const docId = 'late-join-' + Date.now();

        const ctx1 = await browser.newContext();
        const page1 = await ctx1.newPage();

        await enterAsUser(page1, 'Первый', docId);
        const editor1 = page1.locator('.tiptap[contenteditable="true"]');
        await expect(editor1).toBeVisible();

        await editor1.click();
        await page1.keyboard.type('Исходный текст документа');
        await page1.waitForTimeout(1000);

        // Второй подключается позже
        const ctx2 = await browser.newContext();
        const page2 = await ctx2.newPage();
        await enterAsUser(page2, 'Второй', docId);

        const editor2 = page2.locator('.tiptap[contenteditable="true"]');
        await expect(editor2).toBeVisible();

        await expect(editor2).toContainText('Исходный текст документа', { timeout: 5000 });

        await ctx1.close();
        await ctx2.close();
    });
});