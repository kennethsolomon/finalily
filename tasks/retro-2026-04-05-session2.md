# Retrospective — 2026-04-05 (Session 2) — Bug Fixes + UX Polish

## Metrics
| Metric | Value |
|--------|-------|
| Planned tasks | 0 (reactive — user-reported issues) |
| Completed | 15 distinct fixes/improvements |
| Commits | 0 (all uncommitted, 30 modified files) |
| Time span | Single session |
| Files changed | 24 modified, 4 new packages |
| Gate attempts | tsc: 8 manual checks, all passed |
| Blockers | 1 (linter auto-reverted settings.tsx state variables) |
| Rework rate | ~13% (2 of 15 items needed a second pass — cloze answer "cloze" placeholder, cloze snake_case field) |

## Deliverables
1. Drag-and-drop card reordering (@dnd-kit + reorderCards server action)
2. Server-side answer validation (validateAnswer for MCQ/TF/ID/Cloze)
3. Fixed stale "Continue Studying" (revalidatePath "/" not "/dashboard")
4. Study button skips filter screen (default filter=all)
5. Health issues breakdown in deck detail page
6. Restored settings page missing state variables
7. Consolidated "Create Deck" buttons (home page → only for 0 decks)
8. Dynamic card creation form (type-specific fields per card type)
9. Clear card type labels (full names + descriptions, not abbreviations)
10. Fixed Cloze card answer extraction (blanks → joined answer)
11. Fixed Cloze edit form (loads cloze_text, not stripped prompt)
12. Fixed "AI-generated" banner (only for TOPIC/PDF decks, not manual)
13. Fixed Cloze study missing inputs (snake_case → camelCase normalization)
14. Improved toast stacking (visibleToasts=3, duration=2s, gap=8)
15. Saved 5 learned patterns to skills/learned/

## What Went Well
- **Rapid user-driven iteration**: 15 fixes in a single session, each responding to real user feedback with screenshots. Tight feedback loop.
- **Type-checking as safety net**: Ran `tsc --noEmit` after every change — caught zero regressions across 24 modified files.
- **Server-side validation design**: Clean separation — `validateAnswer` returns `boolean | null` (null = can't validate, trust client). Extensible pattern.
- **Learned patterns capture**: Extracted 5 reusable patterns immediately while context was fresh.

## What Didn't Go Well
- **Cloze card creation had 2 bugs**: Hardcoded `"cloze"` as answer, and snake_case field not normalized. Both discovered by user testing, not by code review. The cloze flow needs more careful attention since it has a 3-way data model (prompt = stripped, answer = extracted blanks, cloze_text = original with braces).
- **No commits made**: 30 files modified across the session with zero commits. Risky — one bad edit could require untangling a massive diff. Should commit atomically per logical fix.
- **Linter auto-revert**: Same issue as previous retro (action item #1) — linter/formatter removed state variables between reads. Still not addressed.
- **Settings page state loss**: The `passwordMsg`/`saveMsg` variables were removed by a linter between sessions — discovered only when tsc caught it. Fragile.

## Patterns
- **User testing finds UI/UX bugs that code review misses**: The filter screen confusion, toast overlap, "AI-generated" banner on manual decks — all caught by user clicking through, not by reading code.
- **Supabase snake_case is a recurring trap**: This is the second time a snake_case field caused a silent failure. Need a systematic normalization layer.
- **Cloze cards are the most complex type**: 3 separate data representations (prompt, answer, cloze_text) that must stay in sync across create, edit, and study flows.

## Action Items
1. **Commit atomically after each logical fix** — 30 uncommitted files is risky. Apply during: immediately, before ending this session.
2. **Add Supabase response normalization utility** — A `normalizeCard()` function that maps all snake_case to camelCase at the data boundary. Apply during: next session touching card data.
3. **Investigate linter auto-revert** — Same issue as retro #1, still unresolved. The format-on-save hook is reverting intentional edits. Apply during: next session start.
4. **Test cloze flow end-to-end after changes** — Cloze has 3 data representations and 2 bugs shipped. Add to mental checklist: create → view in list → edit → study → verify inputs appear. Apply during: any cloze-related change.

## Previous Action Item Follow-Up
- **Investigate file watcher conflicts** — Still open. Hit the same issue (linter reverted settings.tsx state).
- **Stage untracked files before feature work** — Partially addressed (edit/page.tsx is now tracked). Still 30 uncommitted files.
- **Consider useActionToast hook** — Not needed yet. Toast count grew but the pattern is simple enough.
