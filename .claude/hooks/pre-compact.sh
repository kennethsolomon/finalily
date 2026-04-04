#!/bin/bash
# Claude Code PreCompact hook: Preserve session state before context compression
# Outputs critical state so Claude retains it after compaction

echo "=== Pre-Compaction State Snapshot ==="

# Git status
echo ""
echo "--- Uncommitted Changes ---"
STAGED=$(git diff --cached --name-only 2>/dev/null)
UNSTAGED=$(git diff --name-only 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)

[ -n "$STAGED" ] && echo "Staged:" && echo "$STAGED" | sed 's/^/  /'
[ -n "$UNSTAGED" ] && echo "Unstaged:" && echo "$UNSTAGED" | sed 's/^/  /'
[ -n "$UNTRACKED" ] && echo "Untracked:" && echo "$UNTRACKED" | sed 's/^/  /'

if [ -z "$STAGED" ] && [ -z "$UNSTAGED" ] && [ -z "$UNTRACKED" ]; then
    echo "  (clean)"
fi

# Log compaction event
if [ -d "tasks" ]; then
    echo "" >> "tasks/progress.md" 2>/dev/null
    echo "### [$(date +%Y-%m-%d)] Context compaction occurred at $(date +%H:%M:%S)" >> "tasks/progress.md" 2>/dev/null
fi

echo ""
echo "--- Recovery ---"
echo "Read tasks/todo.md for current task and progress."
echo "Read tasks/progress.md for recent work."
echo "==================================="
exit 0
