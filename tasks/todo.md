# TODO — 2026-04-06 — Custom AI Model Configuration

## Goal
Allow users to configure their own AI model (local model like Ollama, or their own API key/endpoint) in settings. If custom config is set, use it for all AI generation; if empty, fall back to default OpenRouter API.

## API Contract

### Server Actions (`src/actions/ai-config.ts`)
- `getAIConfig()` → `{ provider, baseUrl, modelName, hasApiKey, maskedApiKey }`
- `updateAIConfig({ provider, apiKey, baseUrl, modelName })` → updated config
- `testAIConnection({ apiKey, baseUrl, modelName })` → `{ success, error? }`
- `clearAIConfig()` → void

### AI Client (`src/lib/openrouter.ts`)
- `createAIClient(config?)` → OpenAI instance (custom or default)
- `getAIModel(config?)` → model string
- `fetchUserAIConfig(supabase, userId)` → raw config from DB

## Plan

### Phase 1: Database
- [x] 1.1 Add Supabase migration: `ai_provider`, `ai_api_key`, `ai_base_url`, `ai_model_name` columns to users table
- [x] 1.2 Update Prisma schema with 4 new User fields
- [x] 1.3 Run `npx prisma generate` to regenerate client

### Phase 2: Backend — AI Client Refactor
- [x] 2.1 Refactor `src/lib/openrouter.ts` — export `createAIClient()`, `getAIModel()`, `fetchUserAIConfig()`
- [x] 2.2 Create `src/actions/ai-config.ts` — getAIConfig, updateAIConfig, testAIConnection, clearAIConfig
- [x] 2.3 Update `src/app/api/generate/topic/route.ts` — fetch user config, use createAIClient/getAIModel
- [x] 2.4 Update `src/app/api/generate/pdf/route.ts` — same pattern
- [x] 2.5 Update `src/app/api/generate/regenerate/route.ts` — same pattern
- [x] 2.6 Update `src/app/api/ai-chat/route.ts` — same pattern
- [x] 2.7 Update `src/actions/profile.ts` getProfile() — strip ai_api_key from response
- [x] 2.8 Update `src/actions/validate-answer.ts` — use user config for answer validation

### Phase 3: Frontend — Settings UI
- [x] 3.1 Add "AI Configuration" section to `src/app/(app)/settings/page.tsx`

### Phase 4: Tests
- [x] 4.1 Test createAIClient fallback logic (default vs custom)
- [x] 4.2 Test getAIModel fallback logic
- [x] 4.3 Test API key masking utility
- [x] 4.4 All 137 existing tests pass

## Acceptance Criteria
- [x] Users can configure custom AI provider (API key, base URL, model name) in settings
- [x] When custom config is set, all AI generation uses the custom provider
- [x] When config is empty/default, falls back to OpenRouter
- [x] API key is never exposed to the client (masked display + stripped from getProfile)
- [x] All 5 AI endpoints respect user config (topic, pdf, regenerate, ai-chat, validate-answer)
- [x] Test connection validates custom config before saving
