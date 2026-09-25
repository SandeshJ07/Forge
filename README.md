# Forge

**Your training, compounding.** Forge is a gym companion that plans your workouts, walks you through them set by set, and shows you the progress piling up — so every session builds on the last.

Try it on the web at **[forge-bro.vercel.app](https://forge-bro.vercel.app)**, and add it to your phone's home screen to use it like a regular app.

---

## What you can do with Forge

### Get a plan built for you
- Tell Forge **which days you can train**, **which muscles to hit each day**, the **equipment you have**, how long a session can be, and anything else it should know ("sore left knee, no jumping").
- An AI coach (Google Gemini or Anthropic Claude) turns that — plus your goals, experience and training history — into **workout groups** like *Push*, *Pull* and *Legs*, each mapped to your training days, with sets, reps, rest times and optional warm-ups.
- Pick **up to two goals** (strength, building muscle, general fitness, endurance); the first one is your main focus.
- Plans are free to generate up to **5 times a day**. Add your own Gemini or Claude API key in Settings for unlimited use.
- Forge reminds you when it's time for a fresh plan (weekly, every two weeks or monthly), and keeps your past plans.

### Log workouts without the fuss
- Open **Log workout** and today's group is waiting — tap **Start** and every exercise, set and warm-up is filled in.
- Add any other exercise with a quick search, or load a different group.
- Tick off sets as you go. A **rest timer** starts automatically and chimes when it's time for the next set; change the rest time for any exercise on the fly.
- Not sure how to do a move? Tap the **ⓘ** next to it for instructions, photos and the muscles it works.
- Finish and Forge tells you about any **new personal records**. Rate how it felt so future plans can adapt.

### See your progress
- **Home** shows your week at a glance: workouts this week, your **weekly streak** with a calendar of the month, personal records and recent sessions.
- The **Log** tab keeps your full history — flip through it **month by month**, with the streak calendar for each month.
- **Progress** tracks body weight and measurements (chest, waist, arms and more) with a chart and a full history of every entry.

### Learn the moves
- A library of **870+ exercises** you can search and filter by muscle and equipment.
- Each exercise has step-by-step instructions, **start and end position photos**, a **muscle map** showing primary and secondary muscles, and a link to video demos.
- Mark exercises you **like** or want to **avoid** — plans favour the ones you like and leave out the rest.

### Your account, your way
- Sign up with your email (confirmed with a 6-digit code) or **continue with Google**. Sign in with your email or your username.
- Metric or imperial units, equipment, goals and reminders can all be changed any time in **Settings**.
- Change your password — or, if you joined with Google, set one so you can sign in either way.
- **Delete your account** whenever you like; everything you've stored goes with it.

### Private by design
- Passwords are never stored — only a secure hash.
- Personal and body data (email address, height, birth year, measurements, notes) and any API keys you add are **encrypted** before they're saved.
- Sign-in and email codes are rate-limited, and codes can't be re-sent instantly, to keep accounts safe from abuse.

---

## For developers

Forge runs on iOS, Android and the web from one codebase.

| Folder | What it is | Details |
|---|---|---|
| [`backend/`](backend/) | FastAPI + SQLAlchemy + Alembic API on Postgres | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend/) | Expo (React Native, TypeScript, expo-router) app for iOS, Android and web | [frontend/README.md](frontend/README.md) |

### Run it locally

1. Set up the backend (Postgres, `.venv`, `backend/.env`, `alembic upgrade head`, exercise seed) — see [backend/README.md](backend/README.md).
2. Set up the frontend (`npm install`, `frontend/.env` with `EXPO_PUBLIC_API_URL`) — see [frontend/README.md](frontend/README.md).
3. On Windows, `start.bat` launches both (API on http://localhost:8000, Expo in its own window).

Secrets live only in `backend/.env` and `frontend/.env`, which are git-ignored; each folder ships a `.env.example` template.

### Deployment

- **Frontend:** static web build on Vercel (`frontend/vercel.json`; root directory `frontend`, env `EXPO_PUBLIC_API_URL`).
- **Backend:** any host that runs a long-lived Python process (e.g. Render), with Postgres (e.g. Neon). On hosts that block outbound SMTP, send email through Brevo or Resend — see [backend/README.md](backend/README.md).

### History

This repository combines the former `Forge_BE` and `Forge_FE` repositories; both histories are preserved under `backend/` and `frontend/`.
