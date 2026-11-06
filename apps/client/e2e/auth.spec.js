import { test, expect } from './fixtures';

const NAME_INPUT = 'input[type="text"]';
const SUBMIT_BUTTON = 'button[type="submit"]';

test.describe('Вход по имени без регистрации', () => {
    test('модалка показывается при первом входе', async ({ page }) => {
        await page.goto('/d/auth-test');

        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('heading', { name: 'Как вас зовут?' })).toBeVisible();
        await expect(page.locator(NAME_INPUT)).toBeFocused();
        await expect(page.locator(SUBMIT_BUTTON)).toBeDisabled();
    });

    test('кнопка заблокирована для пустого имени и одних пробелов', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('');
        await expect(page.locator(SUBMIT_BUTTON)).toBeDisabled();

        await page.locator(NAME_INPUT).fill('   ');
        await expect(page.locator(SUBMIT_BUTTON)).toBeDisabled();
    });

    test('имя сохраняется в localStorage, модалка закрывается', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('Алиса');
        await expect(page.locator(SUBMIT_BUTTON)).toBeEnabled();
        await page.locator(SUBMIT_BUTTON).click();

        await expect(page.locator('form')).toBeHidden();
        await expect(page.locator('.tiptap')).toBeVisible();

        const saved = await page.evaluate(() => localStorage.getItem('userName'));
        expect(saved).toBe('Алиса');
    });

    test('имя можно отправить клавишей Enter', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('Борис');
        await page.locator(NAME_INPUT).press('Enter');

        await expect(page.locator('form')).toBeHidden();
        const saved = await page.evaluate(() => localStorage.getItem('userName'));
        expect(saved).toBe('Борис');
    });

    test('пробелы по краям имени обрезаются', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('  Вика  ');
        await page.locator(SUBMIT_BUTTON).click();

        const saved = await page.evaluate(() => localStorage.getItem('userName'));
        expect(saved).toBe('Вика');
    });

    test('длина имени ограничена 30 символами', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        const input = page.locator(NAME_INPUT);
        await expect(input).toHaveAttribute('maxlength', '30');

        await input.fill('А'.repeat(40));
        const value = await input.inputValue();
        expect(value.length).toBeLessThanOrEqual(30);
    });

    test('при повторном входе модалка не показывается', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('Глеб');
        await page.locator(SUBMIT_BUTTON).click();
        await expect(page.locator('.tiptap')).toBeVisible();

        await page.reload();

        await expect(page.locator('form')).toBeHidden();
        await expect(page.locator('.tiptap')).toBeVisible();
    });

    test('имя видно в списке участников', async ({ page }) => {
        await page.goto('/d/auth-test');
        await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

        await page.locator(NAME_INPUT).fill('Даша');
        await page.locator(SUBMIT_BUTTON).click();

        await expect(page.locator('.tiptap')).toBeVisible();
        await expect(page.getByText('Даша')).toBeVisible();
    });
});