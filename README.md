<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Executar e implantar o aplicativo do AI Studio

Este repositório contém tudo o que você precisa para executar o app localmente.

Versão publicada no AI Studio: https://ai.studio/apps/drive/1xajWY87OcGPIQSTd9pH5jKvc_rIP4N8o

## Como executar localmente

**Pré-requisito:** Node.js instalado.

1. Instale as dependências:
   `npm install`
2. Defina a variável `GEMINI_API_KEY` em [.env.local](.env.local) com a sua chave da Gemini API.
3. Execute o app:
   `npm run dev`

## Implantação

O repositório inclui automações para publicar o frontend no GitHub Pages e o backend como imagem no GitHub Container Registry (GHCR). Também existe um `docker-compose.yml` para rodar tudo via Docker.

1) Frontend (GitHub Pages)
   - O workflow `.github/workflows/frontend-deploy.yml` gera o build Vite e publica `dist/` no GitHub Pages sempre que houver push na `main`.
   - Ative o GitHub Pages em Settings → Pages apontando para a branch `gh-pages` (criadas automaticamente pelo Actions).

2) Backend (GHCR)
   - O workflow `.github/workflows/backend-publish.yml` monta a imagem Docker a partir de `server/Dockerfile` e envia para `ghcr.io/<owner>/lava-rapido-server:latest` quando houver push na `main`.
   - Crie um Personal Access Token (PAT) com permissões `write:packages` e `read:packages` e cadastre como secret `GHCR_TOKEN`.

3) Docker Compose local
   - Para subir tudo com Docker Compose execute:

```bash
docker compose up --build
```

   - O backend responderá em http://localhost:4000 e o servidor de desenvolvimento Vite em http://localhost:5173.

Secrets necessários para CI/CD
- `GHCR_TOKEN` — PAT usado para enviar imagens ao GitHub Container Registry.

Notas e recomendações
- Em produção utilize um armazenamento de arquivos dedicado (ex.: S3) e um banco de dados em vez de JSON local.
- Proteja `ADMIN_PASSWORD_HASH` e `JWT_SECRET` por meio de secrets do repositório ou variáveis de ambiente na plataforma de implantação.

Opção de backend apenas com Cloudflare
- Este repositório inclui um backend alternativo baseado em Cloudflare Workers (D1 + R2) em `cloudflare/`.
- Após publicar o Worker, configure o secret do repositório:
   - `BACKEND_URL` = URL do Worker (ex.: https://lava-rapido-proxy.<sua-conta>.workers.dev)
- Opcional: adicione `VISUALCROSSING_API_KEY` como secret no Worker para previsões mais completas.

Checklist de implantação no GitHub (passo a passo)
1. Adicione os secrets do repositório (Settings → Secrets and variables → Actions):
   - `GHCR_TOKEN` — Personal Access Token com `write:packages` e `read:packages` para publicar a imagem no GHCR.
   - `ADMIN_PASSWORD_HASH` — opcional: hash bcrypt da senha de administrador. Sem ele o backend usa uma senha padrão.
   - `JWT_SECRET` — segredo aleatório para assinar os tokens administradores (recomendado: 32+ caracteres).

2. Como gerar os valores localmente (exemplos):

   # Gerar hash bcrypt para a senha 'minhaSenhaSegura'
   node -e "console.log(require('bcryptjs').hashSync('minhaSenhaSegura', 8))"

   # Gerar segredo aleatório para JWT
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

   Copie as strings geradas e cole nos valores dos secrets.

3. Ative o GitHub Pages:
   - Acesse Settings → Pages e defina a origem como a branch `gh-pages` (gerada pelo workflow do frontend).

4. Após o push na `main`, os workflows executam:
   - Frontend: build Vite e publicação da pasta `dist/` no GitHub Pages.
   - Backend: build da imagem Docker e push para GHCR (`ghcr.io/<owner>/lava-rapido-server:latest`).

5. Executando localmente
   - Via Docker Compose:

```bash
docker compose up --build
```

   - Backend em http://localhost:4000 e frontend dev em http://localhost:5173 (ou a porta escolhida pelo Vite).

Notas de segurança
- Mantenha `ADMIN_PASSWORD_HASH` e `JWT_SECRET` em segredo em produção. Não os versione.
- Em produção sirva os arquivos enviados a partir de um object storage (ex.: S3) e utilize um banco de dados verdadeiro em vez de JSON.

Configuração de CEP e clima (estatísticas do admin)
--------------------------------------------------
A aba "Estatísticas" aceita um CEP (Código de Endereçamento Postal) para buscar coordenadas e consumir os resumos diários de clima do Open-Meteo.

- Ao informar um CEP no painel, o app tenta resolvê-lo via ViaCEP e, em seguida, faz o geocoding da localidade (Open-Meteo, com alternativa Nominatim).
- O último CEP utilizado fica salvo no `localStorage` do navegador (`statsLastCep_v1`) para preencher o campo automaticamente em visitas futuras.
- As coordenadas resolvidas ficam em cache no `localStorage` (`cepCache_v1`) evitando requisições repetidas.
- Se o CEP não puder ser convertido em coordenadas, a interface mostra um aviso e usa as coordenadas padrão (São Paulo).

Limpando CEPs armazenados / último CEP
--------------------------------------
- Para limpar o último CEP salvo e o cache de coordenadas, abra as DevTools do navegador → Application → Local Storage
   e exclua as chaves `statsLastCep_v1` e `cepCache_v1`. Como alternativa, limpe todos os dados do site.

Nota de privacidade
-------------------
- A resolução de CEP usa serviços de terceiros (ViaCEP, geocoding do Open-Meteo, Nominatim). Nenhum CEP é enviado ao backend;
   tudo acontece no navegador. Se precisar de outra abordagem, podemos mover essa lógica para o servidor.

APIs externas
-------------
Este projeto consome alguns serviços públicos e CDNs para fornecer funcionalidades como resolução de CEP, geocoding e
previsão do tempo. Abaixo está um inventário das integrações externas, onde são usadas e recomendações operacionais.

- ViaCEP
   - Endpoint: `https://viacep.com.br/ws/{CEP}/json/`
   - Uso: resolve um CEP para endereço (logradouro, bairro, localidade, UF). Chamado no cliente (`index.js`) e em scripts de
      utilidade (`scripts/check_weather.mjs`). Não requer chave.
   - Recomendações: usar cache (já existe `cepCache_v1`) e tratar erros de rede/limites.

- Open‑Meteo (Geocoding)
   - Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=1&language=pt`
   - Uso: converter strings de endereço/cidade em lat/lon. Utilizado como primeira tentativa de geocoding no cliente.
   - Recomendações: sem chave, mas evitar consultas repetidas (use cache) e mover para backend se precisar de controle de uso.

- Open‑Meteo (Forecast)
   - Endpoint: `https://api.open-meteo.com/v1/forecast?...&daily=weathercode&timezone=auto`
   - Uso: recuperar `weathercode` diário para o intervalo solicitado (painel de estatísticas). Cliente mapeia códigos para
      rótulos/ícones simples.
   - Recomendações: limitar o intervalo de datas e tratar casos sem dados (o app já exibe mensagem quando não há previsão).

- Nominatim (OpenStreetMap) — alternativa de geocoding
   - Endpoint: `https://nominatim.openstreetmap.org/search.php?q={q}&format=jsonv2&limit=1`
   - Uso: alternativa quando Open‑Meteo não encontra correspondência. Chamado com um User‑Agent informativo.
   - Observações: política de uso exige respeito (não sobrecarregar); para produção considere um provedor pago ou instância
      própria de Nominatim.

- WhatsApp (link)
   - URL: `https://wa.me/55{phone}?text={message}`
   - Uso: abrir conversa no WhatsApp/WhatsApp Web (não é uma API REST; é apenas um link gerado pelo cliente).

- CDNs / bibliotecas
   - Chart.js: `https://cdn.jsdelivr.net/npm/chart.js` (carregado dinamicamente pelo cliente)
   - Bootstrap CSS/JS: `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/...` (estilos e componentes)
   - Observações: para ambientes offline ou requisitos de confiabilidade, considere empacotar essas dependências no build.

Boas práticas recomendadas
-------------------------
- Centralizar chamadas em backend quando for necessário controlar quotas, adicionar caching compartilhado e esconder chaves.
- Cache: o cliente já usa `cepCache_v1` e `statsLastCep_v1`. Para produção mova o cache para o backend (Redis, etc.).
- Respeitar Nominatim: use User‑Agent explicativo e não faça scraping; considere um provedor com SLA para uso pesado.
- Mensagens UX: informar o usuário quando não houver dados meteorológicos para as datas solicitadas.

Se desejar, posso também:
- mover a resolução CEP + chamadas de tempo para o backend (implementar endpoints e cache); ou
- adicionar uma breve seção de políticas de uso no README (como limites e quando acionar a alternativa para SÃO PAULO).
