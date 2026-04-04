#!/usr/bin/env bash
# scan-secrets.sh — PreToolUse hook for Edit|Write
# Scans file content for accidental secrets before writing.
# Exit 2 = block. Exit 0 = allow.

set -uo pipefail

INPUT=$(cat)

# Extract the content being written
CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # For Write tool: 'content' field
    # For Edit tool: 'new_string' field
    print(data.get('content', data.get('new_string', '')))
except:
    pass
" 2>/dev/null)

if [[ -z "$CONTENT" ]]; then
  exit 0
fi

# --- High-confidence secret patterns ---

# AWS Access Key IDs
if echo "$CONTENT" | grep -qE '(^|[^A-Za-z0-9])AKIA[0-9A-Z]{16}([^A-Za-z0-9]|$)'; then
  echo "BLOCKED: AWS Access Key ID detected (AKIA...)"
  exit 2
fi

# AWS Secret Access Keys (40 chars base64 after a key assignment)
if echo "$CONTENT" | grep -qE '(aws_secret_access_key|secret_key)\s*[=:]\s*['\''"][A-Za-z0-9/+=]{40}['\''"]'; then
  echo "BLOCKED: AWS Secret Access Key detected"
  exit 2
fi

# GitHub tokens (PAT, OAuth, App)
if echo "$CONTENT" | grep -qE '(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}'; then
  echo "BLOCKED: GitHub token detected"
  exit 2
fi

# OpenAI / Stripe / Anthropic style keys (sk-...)
if echo "$CONTENT" | grep -qE 'sk-[A-Za-z0-9]{20,}'; then
  # Exclude sk:something (ShipKit skill references)
  if ! echo "$CONTENT" | grep -qE 'sk:[a-z]'; then
    echo "BLOCKED: API key detected (sk-...)"
    exit 2
  fi
fi

# Slack tokens
if echo "$CONTENT" | grep -qE 'xox[bpsar]-[A-Za-z0-9-]{10,}'; then
  echo "BLOCKED: Slack token detected"
  exit 2
fi

# Private key blocks
if echo "$CONTENT" | grep -qE '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'; then
  echo "BLOCKED: Private key detected"
  exit 2
fi

# Connection strings with embedded credentials
if echo "$CONTENT" | grep -qE '(mysql|postgres|postgresql|mongodb|redis|amqp)://[^:]+:[^@]+@[^/]+'; then
  # Exclude common placeholders
  if ! echo "$CONTENT" | grep -qE '://(user|username|root|admin|db):(pass|password|secret|changeme|example)@'; then
    echo "BLOCKED: Connection string with embedded credentials detected"
    exit 2
  fi
fi

# Generic password/secret/token assignments with literal string values
# Matches: password = "actual_value", SECRET_KEY: 'actual_value', api_token="actual_value"
# Excludes: env var references like process.env.*, os.environ.*, ${...}, getenv(...)
if echo "$CONTENT" | grep -qiE '(password|secret|token|api_key|apikey|auth_token|access_key)\s*[=:]\s*['\''"][A-Za-z0-9/+=!@#$%^&*]{8,}['\''"]'; then
  # Check it's not an env var reference
  MATCH=$(echo "$CONTENT" | grep -iE '(password|secret|token|api_key|apikey|auth_token|access_key)\s*[=:]\s*['\''"][A-Za-z0-9/+=!@#$%^&*]{8,}['\''"]' | head -1)
  if ! echo "$MATCH" | grep -qE '(process\.env|os\.environ|os\.getenv|getenv|\$\{|env\(|ENV\[)'; then
    # Exclude test files and example configs
    FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_path',''))" 2>/dev/null)
    if ! echo "$FILE_PATH" | grep -qE '(test|spec|example|sample|fixture|mock|stub|fake|\.test\.|\.spec\.)'; then
      echo "WARNING: Possible hardcoded secret detected. Review the value before proceeding."
      echo "  Match: $MATCH"
      # Warning only (exit 0) — too many false positives for hard block
    fi
  fi
fi

exit 0
