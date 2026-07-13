<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/357be20a-981b-40f8-8692-d21f34619576

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure the public `VITE_FIREBASE_*` web-app values in `.env.local`.
   Gemini credentials and model routing are server-side only and are managed by
   the admin model registry; never place an AI provider key in a `VITE_*` value.
3. Run the app:
   `npm run dev`

## Production deployment

The production system uses Firebase for the backend and an nginx-fronted Ubuntu
VM for the web application. The complete setup, release, verification, and
rollback procedure is in [docs/deployment/README.md](docs/deployment/README.md).
