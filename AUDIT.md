# FinaLily Full App Audit

**Date:** 2026-04-05
**Scope:** Data layer, UI components, learning science, infrastructure

---

## BUGS FOUND AND FIXED

### 1. Flashcard Learn Mode: `onAnswer(true)` placeholder ignores actual correctness
**File:** `src/components/cards/study/flashcard-study.tsx:33`
**Status:** ALREADY FIXED (prior session)
The study page stores actual correctness via `cardIsCorrect` ref and uses it in `handleRating`. The `onAnswer(true)` is a signal to show rating buttons, not the final correctness value.

### 2. Orphaned incomplete sessions persist after completing a study session
**File:** `src/actions/study.ts` — `completeSession()` and `getIncompleteSession()`
**Status:** FIXED THIS SESSION
- `completeSession` now cleans up all orphaned incomplete sessions for the same deck
- `getIncompleteSession` auto-completes sessions where all cards are answered

### 3. Cloze card "no blanks" warning only shows after user attempts interaction
**File:** `src/components/cards/study/cloze-study.tsx:129`
**Status:** FIXED (see below)
The warning for misconfigured cards (no `{{blanks}}`) was gated behind `!submitted`, showing the empty form first. Moved the check to render immediately.

### 4. MCQ crashes silently when `card.options` is not an array
**File:** `src/components/cards/study/mcq-study.tsx:23`
**Status:** OK — already guarded with `Array.isArray()` fallback to empty array

---

## BUGS TO FIX (Recommendations)

### 5. Quiz mode does NOT update spaced repetition schedules
**File:** `src/actions/study.ts:345`
**Severity:** HIGH (learning effectiveness)
**Issue:** Only `LEARN` mode runs the SM-2 algorithm. Quiz mode logs answers but never updates `review_schedules`. This means quiz sessions don't contribute to the spaced repetition system at all.
**Fix:** Derive SM-2 quality from correctness in Quiz mode (correct = quality 4, incorrect = quality 1) and update schedules.

### 6. Test mode batches all answer submissions at session end (race condition risk)
**File:** `src/actions/study.ts` + `src/app/(app)/decks/[id]/study/page.tsx:163`
**Severity:** MEDIUM
**Issue:** Test mode collects all answers client-side and submits them via `Promise.allSettled` at finish. If the tab closes mid-test, ALL answers are lost. Also, concurrent bulk submissions can cause race conditions on `correct_count`.
**Fix:** Submit answers incrementally (like Quiz mode) instead of batching at the end.

### 7. `bulk_reorder_cards()` RPC has no ownership check
**File:** `supabase/migrations/20260405000003_add_bulk_reorder_cards_rpc.sql`
**Severity:** MEDIUM (security)
**Issue:** The RPC function updates card positions without verifying that the caller owns the deck. If RLS is not enforced on the `cards` table, any authenticated user could reorder cards in any deck.
**Fix:** Add a deck ownership check inside the function or ensure RLS is active.

### 8. No error boundary for study pages
**Severity:** LOW
**Issue:** If `startSession`, `resumeSession`, or `completeSession` throw, the user just gets redirected to the deck page with no explanation.
**Fix:** Add `error.tsx` in `src/app/(app)/decks/[id]/study/` with a user-friendly message.

---

## IMPROVEMENT SUGGESTIONS (Prioritized)

### Priority 1: Core Learning Effectiveness

#### A. Quiz Mode Should Update SM-2
Students who use Quiz mode are practicing but the app doesn't track their progress. Every correct/incorrect answer should feed the spaced repetition algorithm.

#### B. Show Explanation BEFORE Rating (Learn Mode)
Currently in Learn mode, the student flips the flashcard, sees the answer, then must rate (Again/Hard/Good/Easy). The explanation shows on the card back, but the student commits to their rating without fully processing it. Show explanation prominently before the rating buttons appear — this supports **elaboration** (a proven learning technique).

#### C. Add "Did you get it right?" Step for Flashcards (Learn Mode)
The current flow: flip card → rate difficulty. The problem: the student might rate "Easy" even though they got the concept wrong. Add an explicit "I got it right / I got it wrong" self-check step BEFORE showing the SM-2 rating. This captures **metacognition** accuracy.

#### D. Confidence Self-Rating
After answering any card, ask: "How confident were you?" (1-5 scale). Research shows metacognitive monitoring — knowing what you know — dramatically improves learning. This data can also identify "lucky guesses" vs true knowledge.

### Priority 2: Study Session Quality

#### E. Quick Review Mode (5 cards, 2 minutes)
Many students have 5 minutes between classes. Add a "Quick Review" button on the dashboard that pulls 5 due cards from across all decks. Low friction = more frequent reviews = better retention.

#### F. Session Timer Warning
The timer runs but never warns the student. After 30 minutes, show a gentle nudge: "You've been studying for 30 minutes. Consider taking a break — spaced practice beats marathon sessions."

#### G. Study Streak Freeze
The current streak system resets to 0 on a missed day. This is punishing. Add a "streak freeze" (1 per week) that preserves the streak if the student misses a single day. Reduces anxiety, increases long-term engagement.

#### H. Filter Memory
Each time a student starts a session, they must re-select due/weak/all. Save the last-used filter in localStorage per deck so they can jump straight in.

### Priority 3: Feedback and Analytics

#### I. Results Page: Breakdown by Card Type
The results page shows total correct/incorrect but doesn't break it down by card type (MCQ vs Identification vs Flashcard). Students should see which card types they struggle with.

#### J. Results Page: Time Per Card
Track how long the student spends on each card. Show "Average 8s per card — fastest: Card #3 (2s), slowest: Card #7 (45s)." This reveals which concepts need more study.

#### K. Mastery Indicator on Deck Page
Show a mastery percentage on each deck card (based on average ease factor). Students should see at a glance which decks need attention. Example: "Bio 101 — 72% mastery | 5 cards due today"

#### L. Weak Cards Root Cause Tags
When a student misses a card, prompt: "Why did you miss this? (Forgot / Never learned / Careless mistake)". This data helps distinguish knowledge gaps from attention errors.

### Priority 4: Long-term Features

#### M. Interleaving Mode
Mix cards from multiple decks in one session. Interleaved practice (mixing topics) consistently outperforms blocked practice in research. Add a "Study All Due" button that pulls due cards from all decks.

#### N. Spaced Review Calendar
Show a calendar view of upcoming reviews: "Monday: 12 cards due, Tuesday: 8 cards due..." Helps students plan study time and visualize their review load.

#### O. Export Deck as JSON/CSV
Students should be able to export their decks for backup or sharing outside the app. Add "Export" button in deck settings.

#### P. Elaboration Prompts
After a wrong answer, show: "Can you explain WHY the correct answer is right?" with a text field. This triggers deeper processing than just showing the answer.

---

## INFRASTRUCTURE NOTES

- **Middleware auth is correctly configured** — redirects unauthenticated users to `/auth/login`
- **SM-2 algorithm is correctly implemented** with proper formulas, minimum ease floor, and tests
- **PWA is configured** via Serwist for offline support
- **Prisma schema exists** but all data access uses Supabase client directly — Prisma may be dead code or used only for schema management
- **TailwindCSS 4** with no config file (using defaults) — this is fine for now but limits theme customization
- **No RLS policies visible in migrations** — verify in Supabase dashboard that RLS is enabled on all tables
