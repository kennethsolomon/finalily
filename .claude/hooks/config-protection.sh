#!/usr/bin/env bash
# config-protection.sh — PreToolUse hook for Edit/Write
# Blocks modifications to linter/formatter configs.
# Override: SHIPKIT_ALLOW_CONFIG_EDIT=1

set -euo pipefail

if [[ "${SHIPKIT_ALLOW_CONFIG_EDIT:-0}" == "1" ]]; then
  exit 0
fi

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path from the tool input
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# --- Sensitive files (secrets, keys, certs) ---
SENSITIVE_PATTERNS=(
  ".env"
  ".env.*"
  "*.pem"
  "*.key"
  "*.crt"
  "*.p12"
  "*.pfx"
  "id_rsa"
  "id_ed25519"
  "credentials.json"
  ".npmrc"
  ".pypirc"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      echo "BLOCKED: Sensitive file '$BASENAME' matches pattern '$pattern'."
      echo "Secrets and keys must never be written by Claude."
      echo "Override: set SHIPKIT_ALLOW_CONFIG_EDIT=1"
      exit 2
      ;;
  esac
done

# --- Lock files and generated code (should not be manually edited) ---
GENERATED_PATTERNS=(
  "package-lock.json"
  "yarn.lock"
  "pnpm-lock.yaml"
  "composer.lock"
  "Gemfile.lock"
  "Cargo.lock"
  "poetry.lock"
  "*.gen.ts"
  "*.generated.*"
  "*.min.js"
  "*.min.css"
)

for pattern in "${GENERATED_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      echo "BLOCKED: Generated/lock file '$BASENAME' should not be edited directly."
      echo "Use the package manager to update lock files."
      echo "Override: set SHIPKIT_ALLOW_CONFIG_EDIT=1"
      exit 2
      ;;
  esac
done

# --- Sensitive directories ---
case "$FILE_PATH" in
  */.ssh/*|*.ssh/*)
    echo "BLOCKED: Cannot write to .ssh directory."
    exit 2
    ;;
  */secrets/*|*/.secrets/*)
    echo "BLOCKED: Cannot write to secrets directory."
    exit 2
    ;;
esac

# --- Linter/formatter configs ---
PROTECTED_CONFIGS=(
  ".eslintrc"
  ".eslintrc.js"
  ".eslintrc.cjs"
  ".eslintrc.json"
  ".eslintrc.yml"
  ".eslintrc.yaml"
  "eslint.config.js"
  "eslint.config.mjs"
  "eslint.config.cjs"
  ".prettierrc"
  ".prettierrc.js"
  ".prettierrc.cjs"
  ".prettierrc.json"
  ".prettierrc.yml"
  ".prettierrc.yaml"
  "prettier.config.js"
  "prettier.config.mjs"
  "biome.json"
  "biome.jsonc"
  ".stylelintrc"
  ".stylelintrc.json"
  ".stylelintrc.js"
  "stylelint.config.js"
  "phpstan.neon"
  "phpstan.neon.dist"
  "pint.json"
  "rector.php"
  ".php-cs-fixer.php"
  ".php-cs-fixer.dist.php"
  ".rubocop.yml"
  ".golangci.yml"
  ".golangci.yaml"
  "rustfmt.toml"
  ".clang-format"
)

for config in "${PROTECTED_CONFIGS[@]}"; do
  if [[ "$BASENAME" == "$config" ]]; then
    echo "BLOCKED: Modifying linter/formatter config '$BASENAME'."
    echo "Fix the code instead of weakening the rules."
    echo "Override: set SHIPKIT_ALLOW_CONFIG_EDIT=1"
    exit 2
  fi
done

exit 0
