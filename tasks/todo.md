# TODO — 2026-04-05 — Toast Notifications + Generation Loading Animation

## Goal
Add toast notifications for all user actions (success + error) and animated Lil' Bit mascot loading overlay during AI card generation.

## Plan

### Phase 1: Foundation
- [x] 1.1 Install sonner, mount `<Toaster>` in `src/app/layout.tsx`

### Phase 2: Toast Integration — Decks
- [x] 2.1 `src/app/(app)/decks/new/page.tsx` — toast on createDeck success/error (all 3 modes)
- [x] 2.2 `src/app/(app)/decks/[id]/edit/page.tsx` — toast on updateDeck, addCard, saveCard, deleteCard, publishCard, reorderCards
- [x] 2.3 `src/app/(app)/decks/[id]/_components/delete-deck-button.tsx` — toast on deleteDeck
- [x] 2.4 `src/app/(app)/decks/[id]/review/page.tsx` — toast on accept, save, regenerate, remove, changeType, publishAll

### Phase 3: Toast Integration — Profile, Share, Onboarding
- [x] 3.1 `src/app/(app)/settings/page.tsx` — toast on updateProfile, changePassword
- [x] 3.2 `src/app/(app)/onboarding/page.tsx` — toast on completeOnboarding error
- [x] 3.3 `src/app/share/[code]/_components/import-button.tsx` — toast on importSharedDeck

### Phase 4: Generation Loading Animation
- [x] 4.1 Create `src/components/generation-loading.tsx` — animated Lil' Bit overlay cycling expressions
- [x] 4.2 Add CSS keyframes for expression cycling animation in globals.css
- [x] 4.3 Integrate loading overlay into `decks/new/page.tsx` for topic + PDF generation

## Acceptance Criteria
- [x] Sonner installed and Toaster mounted in root layout
- [x] All deck CRUD operations show success/error toasts
- [x] All card CRUD operations show success/error toasts
- [x] Profile update and password change show toasts
- [x] Share/import operations show toasts
- [x] AI generation shows animated Lil' Bit loading overlay with expression cycling
- [x] Card regeneration shows toast feedback
- [x] Error toasts include actionable context
- [x] Toasts don't fire for read-only operations or auto-navigation flows
