# Brief: what each of a role's attributes is made of, from the sources (2026-11-01)

Same task as the screenwriter's (workbench/briefs/BRIEF-facets.md: read it; its rules bind you), for another role of
SLATE (a realistic Writer/Producer/Director/Actor life simulator). The owner: "I want those meanings to mean something
and actually reflect on the work and not be for decoration. Just want tons of realism here."

Differences from that brief:
- Your role's research file is /home/user/SLATE/research/sources/person/attributes/<role>.json (read only): each
  attribute's group is the attribute whose `name` equals the name in your list; its terms carry the sources' verbatim
  quotes, already checked. Start there; read further primary pages where a meaning is thin.
- Your list: /tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/roles/cut-<role>.json,
  key "a" or "b" as your prompt says. Use each name exactly as the `attribute` id (the lead will give ids later).
- Save pages as $S/dl/roles/<role>-<half>-<slug>.<ext>; write only $S/roles/out/facets-<role>-<half>.json.
- A quote reused from the role's research file is marked "from": "<role research file>" instead of "saved".
- `alsoDrawsOn` names another attribute by its name in either half of the role's cut list (or in the role's research
  file) where a source ties them; `readBy` names who judges or rewards the facet for this role (an awards body's rules,
  a guild's credit test, a casting director, a funder's assessment, a school's assessment, a festival's selection).
Report back in under 150 words: facets per attribute, and any attribute whose meaning stayed thin.
