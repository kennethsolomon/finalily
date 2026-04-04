#!/usr/bin/env bash
# safety-guard.sh — PreToolUse hook for Bash/Edit/Write
# Reads .claude/safety-guard.json for active mode and directory constraints.

set -uo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
GUARD_CONFIG="$PROJECT_ROOT/.claude/safety-guard.json"

if [[ ! -f "$GUARD_CONFIG" ]]; then
  exit 0
fi

INPUT=$(cat)
MODE=$(python3 -c "import json; print(json.load(open('$GUARD_CONFIG')).get('mode', 'off'))" 2>/dev/null || echo "off")

if [[ "$MODE" == "off" ]]; then
  exit 0
fi

# Extract tool info
TOOL_NAME="${TOOL_NAME:-}"
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')
COMMAND=$(echo "$INPUT" | grep -oE '"command"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

# Careful mode: block destructive commands
if [[ "$MODE" == "careful" || "$MODE" == "guard" ]]; then
  if [[ -n "$COMMAND" ]]; then
    DESTRUCTIVE_PATTERNS=(
      "rm -rf"
      "rm -fr"
      "git push --force"
      "git push -f"
      "git reset --hard"
      "git clean -f"
      "DROP TABLE"
      "DROP DATABASE"
      "TRUNCATE TABLE"
      "chmod 777"
      "chmod -R 777"
      "--no-verify"
      "npm publish"
      "npx publish"
      "cargo publish"
      "gem push"
      "twine upload"
    )

    # Block DELETE FROM without WHERE clause
    if echo "$COMMAND" | grep -qiE 'DELETE[[:space:]]+FROM' && ! echo "$COMMAND" | grep -qiE 'WHERE'; then
      echo "BLOCKED by safety-guard: DELETE FROM without WHERE clause detected."
      echo "  Command: $COMMAND"
      echo "  Disable: /sk:safety-guard off"
      exit 2
    fi

    # Block piping curl/wget to shell execution
    if echo "$COMMAND" | grep -qE '(curl|wget)\s.*\|\s*(bash|sh|zsh|source)'; then
      echo "BLOCKED by safety-guard: piping remote content to shell execution."
      echo "  Command: $COMMAND"
      echo "  Disable: /sk:safety-guard off"
      exit 2
    fi

    # Block disk/partition destructive commands
    if echo "$COMMAND" | grep -qE '(mkfs|dd\s+if=|fdisk|parted)'; then
      echo "BLOCKED by safety-guard: disk/partition destructive command detected."
      echo "  Command: $COMMAND"
      echo "  Disable: /sk:safety-guard off"
      exit 2
    fi
    for pattern in "${DESTRUCTIVE_PATTERNS[@]}"; do
      if echo "$COMMAND" | grep -qi "$pattern"; then
        echo "BLOCKED by safety-guard (careful mode): destructive command detected."
        echo "  Command: $COMMAND"
        echo "  Pattern: $pattern"
        echo "  Disable: /sk:safety-guard off"
        exit 2
      fi
    done
  fi
fi

# Freeze mode: block writes outside specified directory
if [[ "$MODE" == "freeze" || "$MODE" == "guard" ]]; then
  FREEZE_DIR=$(python3 -c "import json; print(json.load(open('$GUARD_CONFIG')).get('freeze_dir', ''))" 2>/dev/null || echo "")
  if [[ -n "$FREEZE_DIR" && -n "$FILE_PATH" ]]; then
    # Resolve to absolute paths for comparison
    ABS_FREEZE=$(cd "$PROJECT_ROOT" && cd "$FREEZE_DIR" 2>/dev/null && pwd || echo "$PROJECT_ROOT/$FREEZE_DIR")
    ABS_FILE=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$FILE_PATH")" || echo "$FILE_PATH")

    if [[ "$ABS_FILE" != "$ABS_FREEZE"* ]]; then
      echo "BLOCKED by safety-guard (freeze mode): write outside frozen directory."
      echo "  File: $FILE_PATH"
      echo "  Allowed: $FREEZE_DIR"
      echo "  Disable: /sk:safety-guard off"
      exit 2
    fi
  fi
fi

exit 0
