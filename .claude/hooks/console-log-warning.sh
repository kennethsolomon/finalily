#!/usr/bin/env bash
# console-log-warning.sh — Stop hook
# Scans git-modified files for debug statements and warns if found.

set -uo pipefail

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PROJECT_ROOT"

MODIFIED_FILES=$(git diff --name-only --diff-filter=ACMR 2>/dev/null)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
ALL_FILES=$(echo -e "${MODIFIED_FILES}\n${STAGED_FILES}" | sort -u | grep -v '^$')

if [[ -z "$ALL_FILES" ]]; then
  exit 0
fi

DEBUG_PATTERNS='console\.log\|console\.warn\|console\.error\|console\.debug\|console\.trace\|debugger\b\|\bdd(\|\bdump(\|\bvar_dump(\|\bprint_r(\|\blog\.Print\|log\.Debug\|\bpdb\.set_trace\|\bbreakpoint()'

FOUND=0
REPORT=""

while IFS= read -r file; do
  [[ -z "$file" || ! -f "$file" ]] && continue
  MATCHES=$(grep -n "$DEBUG_PATTERNS" "$file" 2>/dev/null || true)
  if [[ -n "$MATCHES" ]]; then
    FOUND=$((FOUND + 1))
    REPORT+="  $file:\n"
    while IFS= read -r match; do
      REPORT+="    $match\n"
    done <<< "$MATCHES"
  fi
done <<< "$ALL_FILES"

if [[ $FOUND -gt 0 ]]; then
  echo ""
  echo "WARNING: Debug statements found in $FOUND modified file(s):"
  echo -e "$REPORT"
  echo "Consider removing before committing."
fi

exit 0
