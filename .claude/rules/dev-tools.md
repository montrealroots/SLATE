# Development tools (added 2026-10-27, at the owner's request)

Graphify, Superpowers, Agent Skills, Impeccable, Caveman and Ponytail are set up for this project
(`tools/setup/README.md` says how and what persists). They are aids to `CLAUDE.md` and the owner's documents and
never outrank them. Where one of them says otherwise, this is what holds:

- **One agent.** Any skill step that dispatches subagents, parallel agents, agent teams, workflows or reviewer panels
  is not run; the same work is done in this session by this agent. That covers Superpowers'
  subagent-driven-development, dispatching-parallel-agents and the reviewer in requesting-code-review, the agents of
  Agent Skills, Impeccable and Caveman (cavecrew), and the `/graphify` skill's semantic-extraction subagents. A
  skill's single-agent steps may be followed.
- **Saving tokens never saves work.** Caveman and Ponytail shorten how the agent writes and how much code a change
  adds. They never drop a feature the mandate requires, a test, a falsifier, a matrix row, a citation, a research
  attempt, a recorded blocker, or a gate step. Ponytail's "least code" applies inside full coverage, not instead of it.
- **Caveman is for chat only.** Game text keeps the voice; commit messages say what was decided and why; HANDOFF.md,
  the research register, the matrices, `docs/` and code comments are written in full. `/caveman-compress` and
  `/caveman-commit` are not used on this repository, and `docs/` is the owner's words and is never rewritten.
- **Questions.** Superpowers' brainstorming and Agent Skills' interview-me add no question rounds: ask only when a
  reading would change the work materially; otherwise decide and report.
- **Done is the gate.** The two test-driven-development skills (Superpowers and Agent Skills) may guide how a test is
  written; none of the review, simplify or verification skills (Superpowers, Agent Skills, caveman-review,
  ponytail-review, `/simplify`) replaces or lowers `npm run gate`, the mutation thresholds or the matrices. Use one
  of the overlapping skills per task, and check a finding before acting on it.
- **Git.** Work stays on the designated branch: no worktrees or new branches unless asked; finishing-a-development-
  branch never merges to `main`, opens a pull request or deploys without the owner's word; never force-push.
- **The look.** Impeccable critiques against `docs/kept/01-startup-and-persistence/tokens.css` and `docs/SCREENS.md`;
  it does not replace them, and `/impeccable init` writes no PRODUCT.md or DESIGN.md that contradicts the package.
  Its telemetry is off for this project (`.impeccable/config.json`).
- **Graphify is a map, not a source.** The graph is built from code by local parsing (`GRAPHIFY_BACKEND=none`; a
  SessionStart hook runs `graphify update .`), into `graphify-out/`, which is not committed. A graph query helps find
  code; it never stands in for reading the owner's documents, the files a change touches, or a primary source. Its
  hook's reminders are advice.
