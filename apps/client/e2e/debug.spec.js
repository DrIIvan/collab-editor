import { test, expect } from '@playwright/test';

test('диагностика: что реально на странице', async ({ page }) => {
    // Перехватываем ВСЕ консольные сообщения
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
        });
    });

    // Перехватываем ошибки страницы
    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });

    // Переходим на страницу
    await page.goto('/d/debug-test');

    // Ждём 5 секунд пока всё загрузится
    await page.waitForTimeout(5000);

    // Выводим все консольные сообщения
    console.log('\n=== КОНСОЛЬНЫЕ СООБЩЕНИЯ ===');
    consoleMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
    });

    // Выводим ошибки страницы
    console.log('\n=== ОШИБКИ СТРАНИЦЫ ===');
    pageErrors.forEach(error => {
        console.log(error);
    });

    // Делаем скриншот
    await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });

    // Проверяем #root
    const rootContent = await page.locator('#root').innerHTML();
    console.log('\n=== Содержимое #root ===');
    console.log(rootContent || '(ПУСТО)');

    expect(true).toBe(true);
});