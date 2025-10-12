Cloudflare Worker backend para Lava Rápido (sem Railway)

O que este Worker faz
- Implementa toda a API do backend: autenticação admin (JWT), agendamentos (criar/listar/confirmar/apagar), upload de comprovantes (R2) e proxy de clima.
- Persiste dados no Cloudflare D1 (SQLite gerenciado) e arquivos em Cloudflare R2.
- Endpoints compatíveis com o frontend existente:
  - POST /api/appointments (multipart)
  - GET /api/appointments (admin, JWT)
  - GET /api/appointments/public
  - GET /api/appointments/:id/comprovante (admin)
  - POST /api/appointments/:id/confirm (admin)
  - DELETE /api/appointments/:id (admin)
  - GET /api/visual-weather?lat=..&lon=..&start=..&end=..
  - GET /uploads/<key>
  - GET /health

Pré-requisitos
- Conta Cloudflare. Instale Wrangler: `npm i -g wrangler`. Faça login: `wrangler login`.

1) Criar D1 e R2
- D1: crie um banco (ex.: lava_rapido_db). Copie o `database_id`.
- R2: crie um bucket (ex.: lava-rapido-uploads).
- Edite `cloudflare/wrangler.toml` e substitua `database_name`, `database_id` e `bucket_name`.

2) Aplicar migração D1
```powershell
cd .\cloudflare
wrangler d1 migrations apply lava_rapido_db --local=false
```

3) Definir secrets
```powershell
wrangler secret put ADMIN_PASSWORD   # senha admin (texto simples)
wrangler secret put JWT_SECRET       # string aleatória longa
# opcional
wrangler secret put VISUALCROSSING_API_KEY
```

4) Publicar
```powershell
wrangler deploy
```
Você terá uma URL: https://lava-rapido-proxy.<sua-conta>.workers.dev

5) Apontar o frontend (GitHub Pages)
- No GitHub: Settings → Secrets and variables → Actions → New repository secret
  - BACKEND_URL = https://lava-rapido-proxy.<sua-conta>.workers.dev
- O workflow do Pages já injeta `VITE_BACKEND_URL` no build.

CORS
- O Worker retorna `Access-Control-Allow-Origin: *`. Em produção, restrinja para o domínio do seu Pages.

Limites
- Uploads até 1 MB por arquivo (ajustável). Custos/limites do R2 e chamadas externas se aplicam.
