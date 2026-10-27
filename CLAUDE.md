# CLAUDE.md — SLATE (the rebuild)

This repository is the new SLATE, built from the package in `docs/` (moved there from the root on 2026-10-26, as
`docs/BUILD-ORDER.md` layer 0 asks). The package is the instruction.

Before any work, read `docs/MANDATE.md`, then `docs/BUILD-ORDER.md`, then `docs/SCREENS.md`, then `docs/KEEP.md`.
They are the owner's decisions, dated and in the owner's words, and they outrank any assumption carried from the
first SLATE. Then read `HANDOFF.md`, which says where the build stands and what comes next.

The rules in one place:

- **Read, bite, downstream.** Every feature on every page reads real state, changes real state, and is read by
  something that changes an outcome the player meets. A feature that fails any of the three is not built. The proof
  is a feature-to-effect matrix with a consumer at a file and line for every feature, and the falsifiability test
  on every claim, both run by the gate on every commit.
- **Zero decoration.** Nothing shown that nothing reads; nothing asked that nothing uses; no number typed where a sum
  belongs; no choice that ends the same either way; no text that explains instead of does.
- **Full coverage, researched to the source.** Every engine has a coverage matrix; every engine that reads a place
  covers all 252 countries and territories and 170,911 places of the map; every row cites the primary source and the
  date read in a research register the gate holds. Do everything possible to find a fact (web search in every
  phrasing, the institution's own pages and documents, official registers, trade press quoting a primary source,
  archived copies). A fact not found is a blocker named by date, never a guess, and the game says what isn't modeled.
- **No stopping until done.** Done is the whole matrix covered and the gate green end to end. Checkpoint so an
  interruption resumes.
- **Built in order.** `docs/BUILD-ORDER.md`: the repository and the gate, the core, the world, papers and money, the
  person, the screens, the voice, verification. Nothing built on a layer not yet proven.
- **Connected and cohesive.** One model of the world; every system reads the same state through the same engines;
  no second copy of a fact; dates, money, places, papers and history never contradict, and a test holds each
  invariant.
- **The voice.** Natural, coherent and realistic in every word the game says; the engine's vocabulary stays out of
  the player's sight.
- **The look.** The first SLATE's tokens, type, spacing, dark field and gold accent are the starting standard
  (`docs/kept/01-startup-and-persistence/tokens.css`), refined, never cluttered.

Out of the first build, by the owner's rulings (`docs/KEEP.md`, entries 8, 10, 11, 16 to 19): Yale and the School, the
career engine, the attributes, dispositions and traits, the tutorial and the manual, the body, meals and nourishment,
energy and stress, readiness, the earlier residence, the free-text background.

The owner decides: the premise's detail (what the life is a life of, beyond "an actor/actress life simulator"), home
on the first morning, the start date, whether Sleep stays as a clock action, the final wording of every screen. Ask
only when a reading would change the work materially; otherwise decide and report.

**One agent does the work (permanent, from 2026-10-26, until the owner says otherwise).** No workflows, no fan-out of
subagents, no independent-reviewer panels: one agent, in one session, reads, decides, builds, tests and verifies,
end to end. The owner has said one agent's work is as good, and this applies to everything in this repository.

Git: commit messages say what was decided and why; never force-push; no merge to `main` and no deployment without
the owner's explicit word.
