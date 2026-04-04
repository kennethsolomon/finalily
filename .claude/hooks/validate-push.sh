#!/bin/bash
# Claude Code PreToolUse hook: Warns on push to protected branches
# Receives JSON on stdin with tool_input.command
# Exit 0 = allow (warnings only), Exit 2 = block
#
# Warns on: push to main/master/production/release, force push

INPUT=$(cat)

# Parse command
if command -v jq >/dev/null 2>&1; then
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
else
    COMMAND=$(echo "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"command"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Only process git push commands
if ! echo "$COMMAND" | grep -qE '^git[[:space:]]+push'; then
    exit 0
fi

WARNINGS=""

# Check for protected branch names
for branch in main master production release; do
    if echo "$COMMAND" | grep -qE "(origin[[:space:]]+${branch}|[[:space:]]${branch}$)"; then
        WARNINGS="$WARNINGS\nPROTECTED: Pushing to '${branch}' — this is a protected branch. Confirm this is intentional."
    fi
done

# Check for force push
if echo "$COMMAND" | grep -qE '\-\-force([[:space:]]|$)|\-f([[:space:]]|$)'; then
    WARNINGS="$WARNINGS\nFORCE: Using --force push. This rewrites remote history and is destructive."
fi
if echo "$COMMAND" | grep -qE '\-\-force-with-lease'; then
    WARNINGS="$WARNINGS\nFORCE: Using --force-with-lease. Safer than --force but still rewrites history."
fi

if [ -n "$WARNINGS" ]; then
    echo -e "=== Push Validation Warnings ===$WARNINGS\n================================" >&2
fi

exit 0
