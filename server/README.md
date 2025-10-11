Backend POC for LavaRapido

This is a small Node/Express backend intended as a proof-of-concept to:

- Accept appointment creation with optional `comprovante` file upload.
- Store appointment metadata in `server/data/appointments.json`.
- Save uploaded files to `server/uploads/`.
- Provide simple admin login (password -> JWT) and protected admin endpoints to list, view, confirm, and delete appointments.

Quickstart

1. Copy `.env.example` to `.env` and set `JWT_SECRET` (and `ADMIN_PASSWORD_HASH` optionally).

2. Install dependencies:

   npm install

3. Start server in dev mode (requires `nodemon`):

   npm run dev

4. API endpoints

- POST /api/admin/login { password }
- POST /api/appointments (multipart/form-data) fields: nomeCliente, telefoneCliente, servicoId, horario, data, observacoes, comprovante (file)
- GET /api/appointments (requires Authorization: Bearer <token>)
- GET /api/appointments/:id/comprovante (requires Authorization)
- POST /api/appointments/:id/confirm (requires Authorization)
- DELETE /api/appointments/:id (requires Authorization)

Notes

- This POC is intended for local development only. For production use, move file storage to durable external storage (S3, Azure Blob), secure secrets, and add rate limiting and better error handling.
