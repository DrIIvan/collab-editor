import { test as setup } from '@playwright/test';

setup('очистить все данные перед тестами', async ({ page }) => {
    // Этот setup запускается один раз перед всеми тестами
    // и очищает глобальное состояние
});