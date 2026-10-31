#!/bin/bash
# cm.sh MSGFILE: write matrices, commit (gate in hook), push
LOCK=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/commit.lock; touch $LOCK; trap "rm -f $LOCK" EXIT
cd /home/user/SLATE
npm run --silent gate:write > /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/gw.log 2>&1
printf '\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_015rFzHTKoVWwzvrUNo9rEPK\n' >> "$1"
git add -A && git commit -q -F "$1" > /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/commit.log 2>&1 || { tail -20 /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/commit.log; exit 1; }
git push -q origin claude/new-slate-build 2>&1 | tail -2
git log --oneline -1
