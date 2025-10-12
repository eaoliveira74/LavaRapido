import { test, expect } from '@playwright/test';

const BASE_URL = process.env.APP_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.VITE_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

test('cliente consegue criar um agendamento (com servidor ou offline)', async ({ page }) => {
  // Injeta a URL do backend antes do carregamento da página
  await page.addInitScript(url => { window.__BACKEND_URL__ = url; }, BACKEND_URL);
  await page.goto(BASE_URL);

  // Ir para visão do cliente
  await page.getByRole('button', { name: 'Sou Cliente' }).click();
  await expect(page.locator('#client-view')).toBeVisible();

  // Aguardar serviços carregarem
  const serviceSelect = page.locator('#servicoId');
  await serviceSelect.waitFor({ state: 'visible' });
  // Espera até que pelo menos 2 opções existam (placeholder + uma real)
  await page.waitForFunction(() => {
    const sel = document.getElementById('servicoId');
    return sel && sel.options && sel.options.length >= 2;
  });
  // Seleciona a primeira opção real
  await serviceSelect.selectOption({ index: 1 });

  // Aguardar horários disponíveis
  const timeSelect = page.locator('#horario');
  await timeSelect.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const sel = document.getElementById('horario');
    return sel && sel.options && sel.options.length >= 2;
  });
  await timeSelect.selectOption({ index: 1 });

  // Preencher dados do formulário
  await page.fill('#nomeCliente', 'Teste Playwright');
  await page.fill('#telefoneCliente', '(11) 99999-0000');
  await page.fill('#observacoes', 'Agendamento automatizado');

  // Enviar
  await page.click('#appointment-form button[type="submit"]');

  // Verificar mensagem de sucesso (servidor) OU aviso de offline
  const announcement = page.locator('#announcement-container .alert');
  await expect(announcement).toBeVisible();
  const text = await announcement.innerText();
  expect(text).toMatch(/sucesso|offline|Sem conexão|Agendamento/iu);
});
