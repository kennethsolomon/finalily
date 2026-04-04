#!/bin/bash
# Claude Code statusline: Shows persistent status in CLI
# Receives JSON on stdin with context_window, model info
# Outputs a single formatted line

INPUT=$(cat)

# Parse context and model — use jq if available
if command -v jq >/dev/null 2>&1; then
    MODEL=$(echo "$INPUT" | jq -r '.model // "unknown"' 2>/dev/null)
    CTX_USED=$(echo "$INPUT" | jq -r '.context_window.used // 0' 2>/dev/null)
    CTX_TOTAL=$(echo "$INPUT" | jq -r '.context_window.total // 1' 2>/dev/null)
else
    MODEL="unknown"
    CTX_USED=0
    CTX_TOTAL=1
fi

# Calculate context percentage
if [ "$CTX_TOTAL" -gt 0 ] 2>/dev/null; then
    CTX_PCT=$((CTX_USED * 100 / CTX_TOTAL))
else
    CTX_PCT=0
fi

# Branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "none")

# Active task — first unchecked item in todo.md
TASK="—"
if [ -f "tasks/todo.md" ]; then
    TASK=$(grep -m1 '^\- \[ \]' "tasks/todo.md" 2>/dev/null | sed 's/^- \[ \] //' | cut -c1-40)
fi

# Output single line
echo "[${CTX_PCT}%] ${MODEL} | ${BRANCH} | ${TASK}"
