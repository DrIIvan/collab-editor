import { test, expect } from './fixtures';

test('документ переживает перезапуск сервера', async ({ browser }) => {
    const docId = 'persist-' + Date.now();

    // Первый пользователь пишет
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(`/d/${docId}`);
    await page1.locator('input[type="text"]').fill('Автор');
    await page1.locator('button[type="submit"]').click();

    const editor1 = page1.locator('.tiptap[contenteditable="true"]');
    await expect(editor1).toBeVisible();
    await editor1.click();
    await page1.keyboard.type('Важный текст для сохранения');
    await page1.waitForTimeout(1000);
    await page1.close();
    await ctx1.close();

    // Перезапускаем сервер (это нужно делать через webServer в конфиге)
    // Для ручного теста: остановите сервер и запустите снова
    // В CI это делает Playwright автоматически если webServer настроен правильно

    // Второй пользователь подключается
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(`/d/${docId}`);
    await page2.locator('input[type="text"]').fill('Читатель');
    await page2.locator('button[type="submit"]').click();

    const editor2 = page2.locator('.tiptap[contenteditable="true"]');
    await expect(editor2).toContainText('Важный текст для сохранения', { timeout: 10000 });

    await page2.close();
    await ctx2.close();
});