# TODO — offline-mode — PWA offline support + AI key notification

## Goal
Make the app work fully offline (auth persists, decks/cards cached) with AI features gracefully
degraded when offline or API key is missing. Create .env.local.example for new cloners.

## Acceptance Criteria
- [ ] App shell + cached decks/cards load when offline (Serwist staleWhileRevalidate)
- [ ] User stays authenticated offline (no redirect to /auth/login when network fails)
- [ ] Offline banner appears when navigator.onLine === false
- [ ] AI features show clear "unavailable offline" or "API key not configured" notice
- [ ] AI API routes return 503 with descriptive message when no API key configured
- [ ] .env.local.example covers all 5 env vars with descriptions

## Plan

### Phase 2: Service Worker — Offline Caching
- [ ] 2.1 Update `src/app/sw.ts` — add StaleWhileRevalidate for API GETs

### Phase 3: Auth — Offline Resilience
- [ ] 3.1 Update `src/lib/supabase/middleware.ts` — getUser() try/catch → getSession() fallback

### Phase 4: AI — Key Guard + Notification
- [ ] 4.1 Add `isAIConfigured(config?)` to `src/lib/openrouter.ts`
- [ ] 4.2 Guard `src/app/api/generate/topic/route.ts` — 503 when no key
- [ ] 4.3 Guard `src/app/api/generate/pdf/route.ts` — 503 when no key
- [ ] 4.4 Guard `src/app/api/generate/regenerate/route.ts` — 503 when no key
- [ ] 4.5 Guard `src/app/api/ai-chat/route.ts` — 503 when no key

### Phase 5: UI — Offline Banner + AI Notice
- [ ] 5.1 Create `src/components/offline-banner.tsx`
- [ ] 5.2 Create `src/components/ai-unavailable-notice.tsx`
- [ ] 5.3 Mount OfflineBanner in `src/app/(app)/layout.tsx`
- [ ] 5.4 Mount AIUnavailableNotice in `src/app/(app)/decks/new/page.tsx`

### Phase 6: Environment
- [ ] 6.1 Create `.env.local.example`

### Phase 7: Tests
- [ ] 7.1 Test isAIConfigured()
- [ ] 7.2 Test offline middleware fallback
- [ ] 7.3 Verify existing tests pass

---
# ARCHIVED — 2026-04-06 — Custom AI Model Configuration

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
