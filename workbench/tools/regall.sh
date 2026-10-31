#!/bin/bash
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
cd /home/user/SLATE
bash $S/bin/regx.sh papers/residence papers.residence "How someone from abroad can come to live in {name}: each residence route's fee, time, term and what it allows" >/dev/null
bash $S/bin/regx.sh papers/licence papers.licence "The driving licence and identity card the licensing office of {name} issues: who can get one, its fee and how long it lasts" >/dev/null
bash $S/bin/regx.sh papers/numbers papers.numbers "The national number {name} gives its people: its name, issuer, format, when it's given and what needs it" >/dev/null
bash $S/bin/regx.sh papers/passports papers.passports "x" >/dev/null
bash $S/bin/regx.sh money/banks money.banks "x" >/dev/null
bash $S/bin/regx.sh papers/citizenship papers.citizenship "x" >/dev/null
for e in papers/residence papers/licence papers/numbers papers/passports money/banks papers/citizenship; do npx tsx tools/$e/build.ts 2>&1 | grep -E "Error:" | head -1; done
