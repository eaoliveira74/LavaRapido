Backend (Railway) — Guia Rápido

Passos (via painel Railway, com conta GitHub):

1) New Project → Deploy from GitHub → selecione o repositório LavaRapido.
2) Serviço "Node/Express" (auto detecta package.json). Configure:
   - Start Command: node index.js
   - PORT: 4100 (variable)
   - NODE_ENV: production
   - VISUALCROSSING_API_KEY: (opcional, para clima)
3) Volumes persistentes (Settings → Volumes):
   - Mount path: /app/data → para persistir server/data/appointments.json
   - Mount path: /app/uploads → para persistir comprovantes
4) Deploy. Ao subir, verifique Logs e a URL pública (ex.: https://lava-rapido.up.railway.app)
5) No GitHub (repo → Settings → Secrets and variables → Actions → New repository secret):
   - BACKEND_URL = URL pública do Railway (ex.: https://lava-rapido.up.railway.app)

Frontend (GitHub Pages):

O workflow .github/workflows/deploy-frontend.yml constrói o Vite usando VITE_BACKEND_URL=$BACKEND_URL do Secrets e publica no Pages.
Assim, o frontend consumirá a API do Railway de qualquer dispositivo.
POC de backend para LavaRapido

Este é um backend simples em Node/Express, criado como prova de conceito para:

- Aceitar a criação de agendamentos com upload opcional de `comprovante`.
- Armazenar metadados dos agendamentos em `server/data/appointments.json`.
- Salvar arquivos enviados em `server/uploads/`.
- Oferecer login admin básico (senha → JWT) e endpoints protegidos para listar, visualizar, confirmar e remover agendamentos.

Início rápido

1. Copie `.env.example` para `.env` e defina `JWT_SECRET` (e opcionalmente `ADMIN_PASSWORD_HASH`).

2. Instale as dependências:

   npm install

3. Inicie o servidor em modo desenvolvimento (requer `nodemon`):

   npm run dev

4. Endpoints da API

- POST /api/admin/login { password }
- POST /api/appointments (multipart/form-data) campos: nomeCliente, telefoneCliente, servicoId, horario, data, observacoes, comprovante (arquivo)
- GET /api/appointments (requer Authorization: Bearer <token>)
- GET /api/appointments/:id/comprovante (requer Authorization)
- POST /api/appointments/:id/confirm (requer Authorization)
- DELETE /api/appointments/:id (requer Authorization)

Observações

- Este POC é apenas para desenvolvimento local. Em produção, mova o armazenamento de arquivos para um serviço durável (S3, Azure Blob), proteja secrets e implemente rate limiting e tratamento de erros mais robusto.
