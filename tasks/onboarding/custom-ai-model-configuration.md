# Task: Add custom AI model configuration — user can use their own model/API or fall back to default OpenRouter
Date: 2026-04-06 00:00
Branch: not yet created
Flow: feature
Mode: autopilot
Agents: team

## Codebase State
- Recent commits:
  - dd03696 chore: docs
  - f3766ed feat: add study enhancements, deck sharing, quick study, and AI chat
  - 174a975 feat(export): add PDF and Word document export for deck cards
- Modified files: CLAUDE.md (setup-optimizer), new agents/rules files

## Detected Context
- Stack: Next.js 16 + Prisma 7 + Supabase + OpenRouter
- Scope: full-stack (backend model routing + frontend settings UI)
- Missing context flagged:
  - No acceptance criteria for "local model" (Ollama? LM Studio? OpenAI-compatible?)
  - No scope boundaries on which generation features support custom models
  - Security requirements for storing user API keys

## Entry Point
Routed to: /sk:autopilot
