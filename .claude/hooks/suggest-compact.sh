#!/usr/bin/env bash
# suggest-compact.sh — PreToolUse hook for Edit/Write
# Tracks tool call count and suggests /compact at threshold.

set -uo pipefail

THRESHOLD="${SHIPKIT_COMPACT_THRESHOLD:-50}"
REPEAT_INTERVAL=25

# Use a session-scoped counter file
COUNTER_FILE="/tmp/shipkit-tool-count-${PPID:-$$}"

# Read current count
COUNT=0
if [[ -f "$COUNTER_FILE" ]]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
fi

COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Check if we should suggest compaction
if [[ $COUNT -eq $THRESHOLD ]]; then
  echo ""
  echo "HINT: You've made $COUNT+ tool calls this session."
  echo "Consider running /compact if context feels heavy."
elif [[ $COUNT -gt $THRESHOLD ]]; then
  PAST_THRESHOLD=$((COUNT - THRESHOLD))
  if [[ $((PAST_THRESHOLD % REPEAT_INTERVAL)) -eq 0 ]]; then
    echo ""
    echo "HINT: $COUNT tool calls this session. Consider /compact."
  fi
fi

exit 0
