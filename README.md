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
