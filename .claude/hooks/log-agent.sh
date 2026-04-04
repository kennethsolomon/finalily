#!/bin/bash
# Claude Code SubagentStart hook: Log agent invocations for audit trail
# Tracks which agents are being used and when
#
# Input schema (SubagentStart):
# { "agent_id": "agent-abc123", "agent_name": "linter", ... }

INPUT=$(cat)

# Parse agent name
if command -v jq >/dev/null 2>&1; then
    AGENT_NAME=$(echo "$INPUT" | jq -r '.agent_name // "unknown"' 2>/dev/null)
else
    AGENT_NAME=$(echo "$INPUT" | grep -oE '"agent_name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"agent_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
    [ -z "$AGENT_NAME" ] && AGENT_NAME="unknown"
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Append to audit log (create tasks/ dir if needed)
mkdir -p tasks 2>/dev/null
echo "$TIMESTAMP | Agent invoked: $AGENT_NAME" >> "tasks/agent-audit.log" 2>/dev/null

exit 0
