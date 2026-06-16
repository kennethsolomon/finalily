# Task: offline-mode — make app work fully offline except AI features
Date: 2026-06-16
Branch: offline-mode (to be created)
Flow: feature
Mode: autopilot
Agents: team

## Codebase State
- Recent commits:
  - 2fc67a3 fix(pdf): bundle pdf-parse worker into Vercel serverless function
  - 6cefba7 docs: rewrite README with logo, Lil' Bit mascot showcase, and full project docs
  - b813714 Merge pull request #1 from kennethsolomon/feat/custom-ai-model-config
- Modified files: .claude/agents/*.md, CLAUDE.md, src/app/(app)/decks/new/page.tsx, src/app/api/generate/pdf/route.ts, tasks/progress.md

## Detected Context
- Stack: nextjs + Supabase Auth + Prisma + Serwist (PWA) + OpenRouter AI
- Scope: full-stack
- Missing context flagged: none (Supabase auth = persistent sessions offline; Serwist = existing SW vehicle)

## Requirements
- Offline auth: persistent sessions via Supabase cookies (no re-auth required while offline)
- Offline data: decks, cards, study sessions cached locally (service worker + cache API)
- AI features: online-only — graceful notification if API key missing or network unavailable
- .env.local.example: document all required vars for new cloners
- Branch: offline-mode

## Entry Point
Routed to: /sk:autopilot
