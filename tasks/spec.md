# Spec: No Cards Generated

## Root Cause

Two critical bugs prevent cards from being created and visible to the user:

### Bug 1: PDF handler abandons stream (PRIMARY)
**File:** `src/app/(app)/decks/new/page.tsx:211-217`

The PDF handler (`handlePdfSubmit`) does NOT consume the response stream. After checking `res.ok`, it immediately shows a success toast and redirects. But the PDF route returns a streaming response — card creation happens inside the stream. When the client navigates away, the server's stream controller loses its consumer and stops processing. **Result: 0 cards created.**

### Bug 2: Topic handler ignores stream errors
**File:** `src/app/(app)/decks/new/page.tsx:143-150`

The topic handler consumes the stream but discards all event data. If the AI returns invalid JSON, or card insertion fails, the error event is never read. Client shows "Cards generated!" regardless. **Result: false success, potentially 0 cards.**

### Bug 3: PDF route typeMix type mismatch
**File:** `src/app/api/generate/pdf/route.ts:149,158`

The UI sends `typeMix` as `string[]` but the PDF route declares it as `string`. The array is coerced to a comma-joined string (e.g., `"FLASHCARD,MCQ"`) — not properly formatted for the AI prompt.

## Fix Plan

1. **Both handlers**: Parse NDJSON stream, detect errors, verify cards created before redirecting
2. **PDF route**: Fix `typeMix` type to `string[]`, format properly in prompt
3. **Error handling**: Show actual error messages from stream events instead of false success
