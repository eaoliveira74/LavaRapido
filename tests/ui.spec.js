import { test, expect } from '@playwright/test';
const BASE_URL = process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.VITE_URL || 'http://localhost:5173';

test('botões iniciais funcionam: Cliente e Administrador', async ({ page }) => {
  await page.goto(BASE_URL);
  // coletar logs do console do navegador para depuração
  page.on('console', msg => {
    console.log(`PAGE_CONSOLE[${msg.type()}]: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`PAGE_ERROR: ${err.message}`);
  });
  // Verifica que a tela de seleção está visível
  await expect(page.locator('#role-selection-view')).toBeVisible();

  // Verificações iniciais não interativas (mais robustas para CI)
  await expect(page.locator('#select-client-role')).toBeVisible();
  await expect(page.locator('#select-admin-role')).toBeVisible();
  // As views de cliente/administrador começam escondidas
  await expect(page.locator('#client-view')).toHaveClass(/d-none/);
  await expect(page.locator('#admin-view')).toHaveClass(/d-none/);
  // Verifica os cards de clima (pelo menos existem na DOM)
  await expect(page.locator('#weather-card-today')).toBeVisible();
  await expect(page.locator('#weather-card-tomorrow')).toBeVisible();
});

test('navegação interativa: Cliente -> voltar -> Admin (modal)', async ({ page }) => {
  await page.goto(BASE_URL);

  // Clique em "Sou Cliente" e verifique que a visão do cliente aparece
  await page.getByRole('button', { name: 'Sou Cliente' }).click();
  await expect(page.locator('#client-view')).toBeVisible();
  await expect(page.locator('#role-selection-view')).toHaveClass(/d-none/);

  // Voltar para a seleção de perfil
  await page.locator('#logout-button').click();
  await expect(page.locator('#role-selection-view')).toBeVisible();
  await expect(page.locator('#client-view')).toHaveClass(/d-none/);

  // Abrir área do Administrador e conferir se o modal de senha aparece
  await page.getByRole('button', { name: 'Sou Administrador' }).click();
  const adminModal = page.locator('#admin-password-modal');
  await expect(adminModal).toBeVisible();

  // Fechar o modal para encerrar limpo
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(adminModal).toBeHidden();
});
