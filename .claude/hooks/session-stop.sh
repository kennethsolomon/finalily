#!/bin/bash
# Claude Code Stop hook: Log session accomplishments
# Runs when a Claude Code session ends

# Only log if tasks/ directory exists (ShipKit project)
if [ ! -d "tasks" ]; then
    exit 0
fi

TIMESTAMP=$(date +%Y-%m-%d\ %H:%M:%S)

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Count commits in this session (last hour)
RECENT_COMMITS=$(git log --since="1 hour ago" --oneline 2>/dev/null | wc -l | tr -d ' ')

# Append session end to progress.md
{
    echo ""
    echo "### [$TIMESTAMP] Session ended"
    echo "- Branch: $BRANCH"
    echo "- Commits this session: $RECENT_COMMITS"
} >> "tasks/progress.md" 2>/dev/null

exit 0
