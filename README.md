# Forge

A gym companion app: guided workout logging with rest timers, an exercise library, body measurements and progress photos, personal records, motivational stats, and AI-generated weekly training plans (Claude or Gemini). Runs on iOS, Android and the web from one codebase.

| Folder | What it is | Details |
|---|---|---|
| [`backend/`](backend/) | FastAPI + SQLAlchemy + Alembic API on Postgres | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend/) | Expo (React Native, TypeScript, expo-router) app for iOS, Android and web | [frontend/README.md](frontend/README.md) |

## Run it locally

1. Set up the backend (Postgres, `.venv`, `backend/.env`, `alembic upgrade head`, exercise seed) — see [backend/README.md](backend/README.md).
2. Set up the frontend (`npm install`, `frontend/.env` with `EXPO_PUBLIC_API_URL`) — see [frontend/README.md](frontend/README.md).
3. On Windows, `start.bat` launches both (API on http://localhost:8000, Expo in its own window).

Secrets live only in `backend/.env` and `frontend/.env`, which are git-ignored; each folder ships a `.env.example` template.

## History

This repository combines the former `Forge_BE` and `Forge_FE` repositories; both histories are preserved under `backend/` and `frontend/`.
