#!/usr/bin/env python3
# ww.py SPEC.json: like vw.py, for the work engine (research/sources/papers/work)
import sys,runpy
sys.argv=[sys.argv[0]]+sys.argv[1:]
src=open('/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/bin/vw.py').read().replace("R='/home/user/SLATE/research/sources/papers/visits/'","R='/home/user/SLATE/research/sources/papers/work/'")
exec(compile(src,'ww','exec'))
