#!/usr/bin/env bash
# post-edit-format.sh — PostToolUse hook for Edit
# Auto-formats the edited file using the project's formatter.

set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')

if [[ -z "$FILE_PATH" || ! -f "$FILE_PATH" ]]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

format_file() {
  # Biome (JS/TS/JSON)
  if [[ -f "$PROJECT_ROOT/biome.json" || -f "$PROJECT_ROOT/biome.jsonc" ]]; then
    if [[ "$EXT" =~ ^(js|jsx|ts|tsx|json|jsonc)$ ]]; then
      npx biome format --write "$FILE_PATH" 2>/dev/null && return 0
    fi
  fi

  # Prettier (JS/TS/CSS/HTML/MD)
  if [[ -f "$PROJECT_ROOT/.prettierrc" || -f "$PROJECT_ROOT/.prettierrc.json" || -f "$PROJECT_ROOT/.prettierrc.js" || -f "$PROJECT_ROOT/.prettierrc.cjs" || -f "$PROJECT_ROOT/prettier.config.js" || -f "$PROJECT_ROOT/prettier.config.mjs" ]]; then
    if [[ "$EXT" =~ ^(js|jsx|ts|tsx|css|scss|html|md|json|yaml|yml|vue|svelte)$ ]]; then
      npx prettier --write "$FILE_PATH" 2>/dev/null && return 0
    fi
  fi

  # Pint (PHP)
  if [[ -f "$PROJECT_ROOT/pint.json" || -f "$PROJECT_ROOT/vendor/bin/pint" ]]; then
    if [[ "$EXT" == "php" ]]; then
      "$PROJECT_ROOT/vendor/bin/pint" "$FILE_PATH" 2>/dev/null && return 0
    fi
  fi

  # gofmt (Go)
  if [[ "$EXT" == "go" ]]; then
    command -v gofmt &>/dev/null && gofmt -w "$FILE_PATH" 2>/dev/null && return 0
  fi

  # Ruff (Python — modern replacement for Black + isort)
  if [[ "$EXT" == "py" ]]; then
    if [[ -f "$PROJECT_ROOT/ruff.toml" || -f "$PROJECT_ROOT/.ruff.toml" || -f "$PROJECT_ROOT/pyproject.toml" ]]; then
      if command -v ruff &>/dev/null; then
        ruff format "$FILE_PATH" 2>/dev/null && ruff check --fix "$FILE_PATH" 2>/dev/null && return 0
      fi
    fi
  fi

  # Black + isort (Python — fallback if Ruff not configured)
  if [[ "$EXT" == "py" ]]; then
    if command -v black &>/dev/null; then
      black --quiet "$FILE_PATH" 2>/dev/null
      command -v isort &>/dev/null && isort --quiet "$FILE_PATH" 2>/dev/null
      return 0
    fi
  fi

  # cargo fmt (Rust)
  if [[ "$EXT" == "rs" ]]; then
    command -v rustfmt &>/dev/null && rustfmt "$FILE_PATH" 2>/dev/null && return 0
  fi

  # dart format
  if [[ "$EXT" == "dart" ]]; then
    command -v dart &>/dev/null && dart format "$FILE_PATH" 2>/dev/null && return 0
  fi

  return 0
}

format_file
exit 0
