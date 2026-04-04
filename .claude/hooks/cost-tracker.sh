#!/usr/bin/env bash
# cost-tracker.sh — Stop hook (async)
# Logs session metadata to .claude/sessions/cost-log.jsonl

set -uo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
SESSIONS_DIR="$PROJECT_ROOT/.claude/sessions"
LOG_FILE="$SESSIONS_DIR/cost-log.jsonl"

mkdir -p "$SESSIONS_DIR"

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATE=$(date +"%Y-%m-%d")

# Count commits made during this session (last 8 hours)
RECENT_COMMITS=$(git log --since="8 hours ago" --oneline 2>/dev/null | wc -l | tr -d ' ')

# Count modified files
MODIFIED_COUNT=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED_COUNT=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')

echo "{\"timestamp\":\"$TIMESTAMP\",\"date\":\"$DATE\",\"branch\":\"$BRANCH\",\"commits\":$RECENT_COMMITS,\"modified_files\":$MODIFIED_COUNT,\"staged_files\":$STAGED_COUNT}" >> "$LOG_FILE"

exit 0
