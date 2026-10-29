# Title Case on screens (the owner's rule, from the first SLATE)

The owner's rule from the first SLATE (`montrealroots/1221`: `src/engine/core/text.ts`, `tools/title-case.mjs`,
`tools/label-sweep.mjs`), to be held when screens are built (`docs/BUILD-ORDER.md` layer 5):

- **Every label, heading, button, tab and title is Title Case: every word starts with a capital.** Not the
  typographic convention where small words stay lowercase: "Skip To Event", not "Skip to Event"; "Same As Your
  Place Of Birth", "Add A Language".
- **Prose isn't.** A sentence stays a sentence, with its punctuation: anything ending in `.`, `?` or `!`, or longer
  than nine words, and every body, detail, description, note and summary.
- **Left as spelled:** words with no lowercase letter (USA, 3D), words with a capital past their first letter
  (McKinsey, iPhone, P&L, LA, VFX), a word that starts with a digit ("97th", never "97Th"), and anything inside an
  interpolation.
- **A real name keeps its owner's spelling.** Joining words inside a real organization's name stay as it writes them,
  never at its front ("The Producers Guild of America Awards", "The Globe and Mail"), and a name its owner writes in
  lower case stays so ("dm", "Pick n Pay"), verifiable on their own signage. SLATE's own labels are Title Case to
  the letter.
- **The gate holds it.** In the first SLATE, `title-case --check` (labels in the interface) and `label-sweep` (names
  in the content registries, which render as labels) failed the gate; it went unchecked for a while and "Delete slot
  1" sat in a button. When this build's text catalog gains its first label, its text check holds labels to this rule,
  with `titleCaseLabel` and `readsAsProse` ported from 1221's `src/engine/core/text.ts`.
