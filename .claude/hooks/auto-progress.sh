#!/usr/bin/env bash
# auto-progress.sh — PostToolUse hook
# Auto-logs significant git events to tasks/progress.md
# Adapted from claude-mem progressive capture pattern (thedotmack/claude-mem)
#
# Fires after every Bash tool call. Filters internally to only log:
#   git commit — captures the commit message
#   git push   — captures the push target
#   git tag    — captures the tag name
#
# Only writes if tasks/progress.md already exists (never creates it).
# Exit 0 always — never blocks tool execution.

set -euo pipefail

# Guard: only log if tasks/progress.md exists
[ -f "tasks/progress.md" ] || exit 0

input=$(cat)

# Extract tool_name — only process Bash calls
tool_name=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_name', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

[ "$tool_name" = "Bash" ] || exit 0

# Extract the command (first 300 chars is enough to identify the operation)
cmd=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', '')[:300])
except Exception:
    print('')
" 2>/dev/null || echo "")

[ -z "$cmd" ] && exit 0

first_line=$(echo "$cmd" | head -1)
timestamp=$(date '+%H:%M')

append_log() {
  printf '%s\n' "- [$timestamp] Auto: $1" >> tasks/progress.md
}

# git commit — extract message if simple -m "...", else note heredoc
if echo "$first_line" | grep -qE "^git commit"; then
  msg=$(echo "$cmd" | python3 -c "
import sys, re
text = sys.stdin.read()
# Match: -m \"msg\" or -m 'msg'
m = re.search(r'-m [\"\\x27]([^\"\\x27\n]{1,80})', text)
print(m.group(1).strip() if m else 'commit')
" 2>/dev/null || echo "commit")
  append_log "git commit — \"$msg\""
  exit 0
fi

# git push — log target branch/remote
if echo "$first_line" | grep -qE "^git push"; then
  target=$(echo "$first_line" | sed 's/^git push[[:space:]]*//' | cut -c1-60 | tr -d '\n')
  [ -z "$target" ] && target="origin"
  append_log "git push — $target"
  exit 0
fi

# git tag — log tag name
if echo "$first_line" | grep -qE "^git tag"; then
  tag=$(echo "$first_line" | awk '{for(i=1;i<=NF;i++) if ($i !~ /^-/) {last=$i} } END {print last}' | cut -c1-40)
  [ -z "$tag" ] && tag="tag"
  append_log "git tag — $tag"
  exit 0
fi

exit 0
