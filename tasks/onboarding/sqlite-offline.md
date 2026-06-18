# Task: sqlite-offline — Replace Supabase with SQLite + custom auth (100% offline)
Date: 2026-06-16
Branch: sqlite-offline (from main)
Flow: feature
Mode: autopilot
Agents: team

## Codebase State
- Recent commits: main branch, clean Supabase code
- Key files using Supabase: all src/actions/*.ts, all src/app/api/*, src/middleware.ts, src/lib/supabase/*

## Requirements
- Prisma SQLite provider (file:./dev.db)
- Custom session auth: bcrypt passwords, HTTP-only cookie session tokens, Session table in DB
- Demo account seeded: demo@finalily.app / demo123 + sample deck/cards
- Registration page: saves to SQLite, logs user in immediately
- PDF uploads: local temp filesystem, no Supabase Storage
- AI banner on AI pages when OPENROUTER_API_KEY not set
- Remove Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- Only DATABASE_URL=file:./dev.db + optional OPENROUTER_API_KEY needed

## What gets removed
- @supabase/ssr and @supabase/supabase-js usage
- Google OAuth (requires internet)
- Supabase Storage for PDFs

## Entry Point
Routed to: /sk:autopilot
