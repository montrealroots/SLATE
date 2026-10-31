#!/bin/bash
# check.sh CC [year] : run the holidays test and print the computed days for a country
cd /home/user/SLATE
npx vitest run tests/world/holidays 2>&1 | grep -E "Tests|FAIL|AssertionError|Expected|Received|^\s+[-+] " | head -40
