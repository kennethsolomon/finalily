<div align="center">

<img src="public/logo.png" alt="Finalily Logo" width="120" />

# Finalily

**The study app that actually makes sense.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ecf8e?logo=supabase)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<img src="public/mascot/happy.png" alt="Lil' Bit — Finalily's mascot" width="96" />

*Meet **Lil' Bit** — your 8-bit study companion. She's always rooting for you.*

</div>

---

## What is Finalily?

Finalily is an AI-powered flashcard and spaced-repetition study app built for students who are tired of apps that get in the way. Generate decks from a topic or a PDF, study with five card types, track your streaks, and share decks with classmates — all in one place.

> **Lil' Bit** is our mascot: a double pun on "Lily" and the 8-bit pixel art style she's drawn in. She reacts to how you're studying — happy when you're on a roll, a little smug when you ace a hard card.

---

## Features

- **AI Deck Generation** — create flashcard decks from any topic or uploaded PDF
- **5 Card Types** — Flashcard, Multiple Choice, Identification, True/False, Cloze
- **Spaced Repetition** — SM-2 algorithm schedules reviews at the right time
- **Study Modes** — Learn, Quiz, and Test sessions with per-card stats
- **Deck Sharing** — share decks via a 6-character code or public link
- **Export** — download decks as PDF or Word documents
- **AI Chat** — ask questions about your deck content mid-session
- **PWA** — installable on mobile and desktop, works offline
- **Streaks & Goals** — track daily study habits

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 7 |
| Auth | Supabase Auth (SSR) |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide |
| AI | OpenAI SDK via OpenRouter |
| Testing | Vitest 4 |
| PWA | Serwist |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/kennethsolomon/finalily.git
cd finalily
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anon key |
| `DATABASE_URL` | Yes | PostgreSQL connection string (from Supabase) |
| `OPENROUTER_API_KEY` | **No** | AI card generation (see note below) |

> **OpenRouter API key is optional.** Without it, all features work except AI card generation (From Topic, Upload PDF). You can still create decks manually, study, use spaced repetition, export, and share. You can also add your own API key later in **Settings → AI Configuration** without touching `.env.local`.
>
> Get a free key at [openrouter.ai](https://openrouter.ai) if you want AI generation.

Get your Supabase credentials from: **Supabase dashboard → Project Settings → API**

### 3. Set up the database

```bash
npx prisma migrate dev
```

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — sign up and start studying.

---

## Offline Mode

Finalily is a PWA and works offline after the first visit. Here's what that means in practice:

**Works offline:**
- Viewing decks and cards (cached after first load)
- Studying with spaced repetition
- Your session stays logged in — no redirect to login

**Requires internet:**
- AI card generation (From Topic, Upload PDF)
- Syncing new data with the database

**How to enable offline caching** (requires a production build — the dev server does not cache):

```bash
npm run build
npm start        # visit http://localhost:3000
```

After visiting the app once, the service worker caches pages. You can then go offline in your browser's DevTools (Network → Offline) and navigate around normally.

The app shows a yellow banner when you're offline and a notice on AI generation pages explaining that those features need a connection.

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

---

## Project Structure

```
src/
├── app/
│   ├── (app)/          # Authenticated routes (decks, settings, onboarding)
│   ├── api/            # API routes (AI generation, draft cards)
│   └── share/          # Public share pages
├── actions/            # Server actions (cards, decks, study, share, profile)
├── components/         # UI components
│   └── cards/          # Per-card-type editor + study components
└── lib/                # Utilities (Prisma, Supabase, SM-2, OpenRouter)
prisma/                 # Schema + migrations
```

---

## Meet Lil' Bit

<div align="center">

| Happy | Smug | Surprised | Sad | Winking | Sleeping |
|:-----:|:----:|:---------:|:---:|:-------:|:--------:|
| <img src="public/mascot/happy.png" width="56" /> | <img src="public/mascot/smug.png" width="56" /> | <img src="public/mascot/surprised.png" width="56" /> | <img src="public/mascot/sad.png" width="56" /> | <img src="public/mascot/winking.png" width="56" /> | <img src="public/mascot/sleeping.png" width="56" /> |

</div>

Lil' Bit reacts to your study performance throughout the app. Ace a hard card and she'll be smug about it. Fall asleep on your reviews and she will too.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit using [conventional commits](https://www.conventionalcommits.org): `feat(scope): message`
4. Open a pull request

---

## License

MIT © [Kenneth Solomon](https://github.com/kennethsolomon)
