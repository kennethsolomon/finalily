#!/bin/bash
# Claude Code SessionStart hook: Load project context at session start
# Outputs context that Claude sees when a session begins

echo "=== ShipKit — Session Context ==="

# Current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -n "$BRANCH" ]; then
    echo "Branch: $BRANCH"
    echo ""
    echo "Recent commits:"
    git log --oneline -5 2>/dev/null | while read -r line; do
        echo "  $line"
    done
fi

# Tech debt count
if [ -f "tasks/tech-debt.md" ]; then
    TOTAL=$(grep -c "^### \[" "tasks/tech-debt.md" 2>/dev/null || echo 0)
    RESOLVED=$(grep -c "^Resolved:" "tasks/tech-debt.md" 2>/dev/null || echo 0)
    UNRESOLVED=$((TOTAL - RESOLVED))
    if [ "$UNRESOLVED" -gt 0 ]; then
        echo "Tech Debt: $UNRESOLVED unresolved item(s)"
    fi
fi

# Code health (skip on large codebases to keep session start fast)
if [ -d "src" ]; then
    FILE_COUNT=$(find src/ -type f 2>/dev/null | head -1001 | wc -l | tr -d ' ')
    if [ "$FILE_COUNT" -le 1000 ]; then
        TODO_COUNT=$(grep -r "TODO" src/ 2>/dev/null | wc -l | tr -d ' ')
        FIXME_COUNT=$(grep -r "FIXME" src/ 2>/dev/null | wc -l | tr -d ' ')
        if [ "$TODO_COUNT" -gt 0 ] || [ "$FIXME_COUNT" -gt 0 ]; then
            echo ""
            echo "Code health: ${TODO_COUNT} TODOs, ${FIXME_COUNT} FIXMEs in src/"
        fi
    fi
fi

# Current task — first unchecked item in tasks/todo.md
if [ -f "tasks/todo.md" ]; then
    CURRENT_TASK=$(grep -m1 '^\- \[ \]' "tasks/todo.md" 2>/dev/null | sed 's/^- \[ \] //')
    if [ -n "$CURRENT_TASK" ]; then
        echo ""
        echo "Current task: $CURRENT_TASK"
    fi
fi

echo "==================================="
exit 0
