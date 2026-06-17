<div align="center">

<img src="public/logo.png" alt="Finalily Logo" width="120" />

# FinaLily

**The study app that actually makes sense.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-offline--first-003b57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<img src="public/mascot/happy.png" alt="Lil' Bit — Finalily's mascot" width="96" />

*Meet **Lil' Bit** — your 8-bit study companion. She's always rooting for you.*

</div>

---

## What is FinaLily?

FinaLily is an AI-powered flashcard and spaced-repetition study app. Generate decks from a topic or a PDF, study with five card types, track your streaks, and share decks with classmates — all stored locally with no cloud account required.

> **Lil' Bit** is our mascot: a double pun on "Lily" and the 8-bit pixel art style she's drawn in.

---

## Features

- **AI Deck Generation** — create flashcard decks from any topic or uploaded PDF
- **5 Card Types** — Flashcard, Multiple Choice, Identification, True/False, Cloze
- **Spaced Repetition** — SM-2 algorithm schedules reviews at the right time
- **Study Modes** — Learn, Quiz, and Test sessions with per-card stats
- **Deck Sharing** — share decks via a 6-character code or public link
- **Export** — download decks as PDF or Word documents
- **AI Chat** — ask questions about your deck content mid-session
- **PWA** — installable on mobile and desktop
- **Streaks & Goals** — track daily study habits
- **100% Offline** — SQLite database, no cloud services required

---

## Quick Start (3 steps)

```bash
# 1. Clone and install
git clone https://github.com/kennethsolomon/finalily.git
cd finalily
npm install

# 2. Set up environment
cp .env.local.example .env.local

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app is ready with a demo account.

> **Demo account:** `demo@finalily.app` / `demo123`

The repo includes a pre-seeded `dev.db` so no database setup is required.

---

## Setup Guide

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/kennethsolomon/finalily.git
cd finalily
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and configure AI (see [AI Configuration](#ai-configuration) below). The database is pre-configured and ready — no changes needed unless you move the DB file.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database

The repository includes a ready-to-use `dev.db` (SQLite) with seed data. **No migration commands are needed on a fresh clone.**

If you want to reset the database to a clean state:

```bash
# Reset and re-seed (wipes all data)
rm dev.db
DATABASE_URL="file:./dev.db" npx prisma migrate deploy
DATABASE_URL="file:./dev.db" npm run seed
```

**Seed data includes:**

| Account | Password | Role |
|---------|----------|------|
| `demo@finalily.app` | `demo123` | Demo user with sample deck |

### Register your own account

Click **Sign up** on the login page, or go to [http://localhost:3000/auth/signup](http://localhost:3000/auth/signup).

---

## AI Configuration

FinaLily uses AI for deck generation and answer validation. Three options, in priority order:

### Option A — LM Studio (local, no internet required) ✓ default

Best for offline use. Requires [LM Studio](https://lmstudio.ai) running on your machine or local network.

**Setup:**
1. Download [LM Studio](https://lmstudio.ai)
2. Download a model (recommended: `qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2`)
3. Go to **Developer** tab → **Start Server**
4. Set in `.env.local`:

```env
LM_STUDIO_BASE_URL=http://YOUR_LOCAL_IP:1234/v1
LM_STUDIO_MODEL=qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2
```

Find your local IP: `ipconfig getifaddr en0` (Mac) or `hostname -I` (Linux)

### Option B — OpenRouter (cloud, free models available)

```env
OPENROUTER_API_KEY=your_key_here
```

Get a free key at [openrouter.ai](https://openrouter.ai). When set, OpenRouter takes priority over LM Studio.

### Option C — Custom provider

Configure a custom OpenAI-compatible endpoint in **Settings → AI Configuration** inside the app.

### AI priority order

```
Custom (per-user settings) → OpenRouter (OPENROUTER_API_KEY) → LM Studio (fallback)
```

If no API key is set and LM Studio is not running, AI features will fail gracefully with an error message.

---

## Environment Variables

Full reference for `.env.local`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite file path |
| `OPENROUTER_API_KEY` | No | — | OpenRouter API key for cloud AI |
| `LM_STUDIO_BASE_URL` | No | `http://192.168.1.28:1234/v1` | LM Studio server URL |
| `LM_STUDIO_MODEL` | No | `qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2` | LM Studio model name |
| `SESSION_SECRET` | No | — | Optional cookie signing secret |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run seed` | Re-seed the database with demo data |

---

## Setting Up on a New Machine

Complete step-by-step for a fresh machine:

```bash
# Install Node.js 20+ first (https://nodejs.org or use nvm)
node --version   # should be 20+

# Clone
git clone https://github.com/kennethsolomon/finalily.git
cd finalily

# Install
npm install

# Environment
cp .env.local.example .env.local
# Edit .env.local — set LM_STUDIO_BASE_URL to your LM Studio server IP if different

# Run
npm run dev
# → Open http://localhost:3000
# → Log in with demo@finalily.app / demo123
# → Or click Sign up to create your own account
```

**With LM Studio on the same machine:**

```bash
# In .env.local, use localhost instead of a network IP:
# LM_STUDIO_BASE_URL=http://localhost:1234/v1
```

**With LM Studio on another machine in the same network:**

```bash
# Find the host machine's IP (on that machine):
#   Mac:   ipconfig getifaddr en0
#   Linux: hostname -I
# Then in .env.local on the new machine:
# LM_STUDIO_BASE_URL=http://192.168.1.28:1234/v1
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/          # Authenticated routes (decks, study, settings, analytics)
│   ├── api/            # API routes (auth, AI generation, export)
│   └── share/          # Public share pages
├── actions/            # Server actions (cards, decks, study, share, profile)
├── components/         # UI components
│   └── cards/          # Per-card-type editor + study components
└── lib/                # Utilities (Prisma, session, SM-2, OpenRouter)
prisma/
├── schema.prisma       # Database schema
├── migrations/         # SQLite migration files
└── seed.ts             # Demo data seeder
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | SQLite via Prisma 7 |
| Auth | Custom session auth (bcrypt + HTTP-only cookie) |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide |
| AI | OpenAI SDK (OpenRouter / LM Studio) |
| Testing | Vitest 4 |
| PWA | Serwist |

---

## Meet Lil' Bit

<div align="center">

| Happy | Smug | Surprised | Sad | Winking | Sleeping |
|:-----:|:----:|:---------:|:---:|:-------:|:--------:|
| <img src="public/mascot/happy.png" width="56" /> | <img src="public/mascot/smug.png" width="56" /> | <img src="public/mascot/surprised.png" width="56" /> | <img src="public/mascot/sad.png" width="56" /> | <img src="public/mascot/winking.png" width="56" /> | <img src="public/mascot/sleeping.png" width="56" /> |

</div>

Lil' Bit reacts to your study performance. Ace a hard card and she'll be smug about it. Fall asleep on your reviews and she will too.

---

## License

MIT © [Kenneth Solomon](https://github.com/kennethsolomon)
