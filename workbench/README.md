# workbench

The lead agent's working files from the research waves of layers 1 to 3, saved on 2026-10-31 before layer 4 planning
so that an interrupted session can resume without them.

- `briefs/`: the briefs each wave's subagents were given (`BRIEF-wave6.md` to `BRIEF-wave17.md`, `BRIEF-roles.md`,
  `BRIEF-ages.md`), the audit notes per layer (`core.md`, `world.md`, `money.md`, `papers.md`, `FORMS.md`), and
  `industry/`: the per-country film-industry brief (`BRIEF-industry.md`) and its ten country lists, prepared and not
  launched; it waits for the layer 4 plan.
- `tools/`: the writer and integration scripts. `gw.py` writes a research file from a spec and checks each quoted
  sentence against its saved page, `chk.mts` checks an engine's file, `padd.py` registers a file, `appendblk.py` and
  `integrate.sh` carry a wave's blockers into the register. They name the session scratchpad by absolute path, which
  a new session replaces with its own.
- `notes/`: the lead's notes on papers, prices and the build.
- `configs/`: the Stryker and vitest configs used for per-engine mutation runs
  (`npx stryker run workbench/configs/stryker.<engine>.mjs --mutate "<file>:<lines>"`).

Nothing here is read by the game or the gate; the gate's lint ignores this directory.
