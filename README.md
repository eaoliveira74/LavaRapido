<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xajWY87OcGPIQSTd9pH5jKvc_rIP4N8o

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment

This project includes helpers to publish the frontend to GitHub Pages and the backend as a container image to GitHub Container Registry (GHCR). There is also a `docker-compose.yml` to run the app locally using Docker.

1) Frontend (GitHub Pages)
   - The workflow `.github/workflows/frontend-deploy.yml` builds the Vite app and publishes `dist/` to GitHub Pages on push to `main`.
   - Enable GitHub Pages in repository Settings -> Pages and point to the `gh-pages` branch (actions will create it).

2) Backend (GHCR)
   - The workflow `.github/workflows/backend-publish.yml` builds the Docker image from `server/Dockerfile` and pushes to GHCR as `ghcr.io/<owner>/lava-rapido-server:latest` when a push to `main` occurs.
   - Create a Personal Access Token (PAT) with `write:packages` and `read:packages` and add it to the repository secrets as `GHCR_TOKEN`.

3) Local Docker Compose
   - Run the app locally with Docker Compose:

```bash
docker compose up --build
```

   - The backend will be available on http://localhost:4000 and the front-end Vite dev server on http://localhost:5173.

Secrets required for CI/CD
- `GHCR_TOKEN` — PAT for pushing images to GitHub Container Registry.

Notes and recommendations
- For production consider using a proper file storage (S3) and a database instead of local JSON files.
- Secure `ADMIN_PASSWORD_HASH` and `JWT_SECRET` via repository secrets or environment variables in your deployment platform.

GitHub deployment checklist (step-by-step)
1. Add repository secrets (Settings → Secrets and variables → Actions):
   - `GHCR_TOKEN` — a Personal Access Token (classic) with `write:packages` and `read:packages` to allow the backend image to be pushed to GitHub Container Registry (GHCR).
   - `ADMIN_PASSWORD_HASH` — optional: bcrypt hash of the desired admin password. If omitted the server uses a default development password.
   - `JWT_SECRET` — a long random secret used to sign admin JWTs. Recommended: 32+ random characters.

2. How to generate the values locally (example commands):

   # Generate a bcrypt hash for password 'minhaSenhaSegura' using Node
   node -e "console.log(require('bcryptjs').hashSync('minhaSenhaSegura', 8))"

   # Generate a random JWT secret (Node)
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

   Copy the output strings and paste them into the repository secret values.

3. Enable GitHub Pages for the repository:
   - Go to Settings → Pages and set the source to the `gh-pages` branch (the frontend deploy Action creates/pushes this branch).

4. After pushing to `main` the Actions will run:
   - Frontend Action builds the Vite app and deploys `dist/` to GitHub Pages.
   - Backend Action builds and pushes a Docker image to GHCR (`ghcr.io/<owner>/lava-rapido-server:latest`).

5. Running the stacks (locally)
   - Using Docker Compose (local):

```bash
docker compose up --build
```

   - Backend will be available at http://localhost:4000 and the frontend dev server at http://localhost:5173 (or the port Vite chooses).

Notes and security
- Keep `ADMIN_PASSWORD_HASH` and `JWT_SECRET` secret in production. Do not commit them to the repo.
- In production, serve uploaded files from object storage (S3 or equivalent) and use a real database instead of a JSON file.

CEP and weather settings (admin statistics)
----------------------------------------
The admin "Estatísticas" view accepts a CEP (Código de Endereçamento Postal) which the app will
use to look up coordinates and fetch simple daily weather summaries from Open-Meteo.

- When you enter a CEP in the admin stats panel, the application will try to resolve it via ViaCEP
   and then geocode the resulting locality (Open-Meteo geocoding, with Nominatim as a fallback).
- The last CEP you entered is persisted in your browser's `localStorage` under the key
   `statsLastCep_v1` so the field remains prefilled on future visits.
- Resolved CEP coordinates are cached in `localStorage` under the key `cepCache_v1` to reduce
   repeated external lookups.
- If the CEP cannot be resolved to coordinates, the UI will show a small warning and the app will
   fall back to default coordinates (São Paulo) for the weather lookup.

Clearing cached CEPs / last CEP
--------------------------------
- To clear the stored last CEP and any cached CEP coordinates, open the browser devtools → Application → Local Storage
   and remove the keys `statsLastCep_v1` and `cepCache_v1` for this site. Alternatively you can clear all site data.

Privacy note
------------
- CEP resolution uses third-party services (ViaCEP, Open-Meteo geocoding, Nominatim). No CEPs are sent to the project's
   backend in this flow; they are used client-side in the browser. If you require different behavior, we can change the
   implementation to resolve CEPs on the server instead.
