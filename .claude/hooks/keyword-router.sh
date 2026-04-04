#!/usr/bin/env bash
# keyword-router.sh — UserPromptSubmit hook
# Detects magic keyword prefixes and injects routing context for Claude.
# Keywords: autopilot:, debug:, fast:, interview:, team:
# Exit 0 always — never blocks the prompt.

set -euo pipefail

input=$(cat)
prompt=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null || echo "")

if [[ -z "$prompt" ]]; then
  exit 0
fi

lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

route() {
  local keyword="$1"
  local skill="$2"
  local task="${prompt#*:}"
  task="${task# }"
  echo "[Keyword router] Detected \"${keyword}\" prefix — invoke ${skill} with task: \"${task}\""
  exit 0
}

if [[ "$lower" == autopilot:* ]];  then route "autopilot:"  "/sk:autopilot"; fi
if [[ "$lower" == "debug:"* ]];    then route "debug:"      "/sk:debug"; fi
if [[ "$lower" == "fast:"* ]];     then route "fast:"       "/sk:fast-track"; fi
if [[ "$lower" == "interview:"* ]]; then route "interview:" "/sk:deep-interview"; fi
if [[ "$lower" == "team:"* ]];     then route "team:"       "/sk:team"; fi

exit 0
