# The screenwriter's attributes and what each one changes (plan, 2026-10-31)

The owner's rulings of 2026-10-31: attributes return for all four roles; each role keeps its most-backed set, the lead
proposing the cut and the owner approving it; each is shown as a number ("Dialogue - 92"); each has an engine and a
downstream effect behind it, balanced later. This is the screenwriter's proposal, for the owner's approval before
anything is built. The research is `research/sources/person/attributes/screenwriter.json` (R-4601).

## The cut

An attribute is kept where at least four independent institutions name it for the screenwriter (a source's pages count
once per institution: ESCO's many pages are one). That is 31 of the 480. Of those 31:

- Two are not held by the person but are what the readers conclude about a script: "Story" (Nicholl, Austin, Screen
  Australia) and "potential to develop into a professional writer" (Nicholl, BBC Writers, Screen Australia). They are
  outcomes of the evaluation engine below, never a number the player holds.
- Two pairs name one thing: "follow work schedule" (ESCO, CPNEF-AV, NFTS, berufsberatung.ch) goes under Time
  Management (O*NET, Québec, WorkBC, NFTS); "communication and language skills" (France Travail, LFS, NFTS, Bamberg)
  under Speaking and Writing, which it names together.

That leaves 27, each 0 to 100. Every other researched attribute stays in the research file, unused.

## The engines that read them

Built 2026-10-31 (src/person/work): the script, the readers (the Black List, PAGE), the writing and the notes. Still to
build: selling and staffing, the room, coverage work; each with its tests and its falsifiers before the attribute that
feeds it is shown.

- **The script** (`work.script`): a script the player writes (feature, pilot, episode, short) has a score for each
  component a real reader grades. A component's score comes from the attribute that writes it, the time given and the
  revisions made. Where the research gives a draft's steps (the WGA's treatment, first draft, second draft, rewrite,
  polish, each with its minimum, `person.roles.screenwriter`), the script moves through them.
- **The readers** (`work.evaluation`): every gatekeeper scores a script by its own published rubric, read from the
  research: the Black List's 1 to 10 scores for premise, plot, character, dialogue and setting; PAGE's ten criteria;
  the Nicholl readers' rubric; Austin's readers; BBC Writers' open call; Screen Australia's story assessment; the
  CNC's, the BFI's and Creative Europe's development criteria. The outcome is the gatekeeper's own: a score, a
  placement, a fellowship, a lab place, development money, a read request. Each rubric's weights are the source's
  where it publishes them (Screen Australia: Story 60%), and the game's own figure, labelled so, where it doesn't.
- **The writing** (`work.writing`): how long a draft takes and whether it is delivered on time, against the deadlines
  a deal sets (the MBA's delivery periods in `person.roles.screenwriter`).
- **The notes** (`work.notes`): a producer's, an executive's or a reader's notes on a draft, and how far a revision
  answers them; it decides whether the writer is kept for the next step or replaced (the WGA's step deal), and what
  the credit arbiters later find on the page.
- **Selling and staffing** (`career.selling`): meetings, pitches, a spec's sale, an open writing assignment, a
  staffing season; what decides each is read from the research (the studios' writing programmes' selection, the
  agencies' and managers' reading, the WGA's minimums for what is paid).
- **The room** (`work.room`): in series television, the writer's standing in a writers' room, which decides episodes
  assigned and being kept on for the next season (the WGA's room levels, staff writer to showrunner).
- **Coverage work** (`work.coverage`): reading and grading other writers' scripts as a story analyst (IATSE Local
  700's members, UCLA Extension's course), which is paid work and also how well the writer judges their own draft.

## The 27 attributes

Each line: the attribute as shown, what reads it, what it changes, and the institutions that name it.

### Writing the script (read by `work.script`, judged by `work.evaluation`)

1. **Characters**: the script's character score, graded by the Nicholl readers, Austin, PAGE, the Black List and BBC
   Writers; arbiters weigh characterization for screenplay credit. (12 institutions: AFF, BBC, the Black List, France
   Compétences, O*NET, PAGE, Nicholl, UCLA, USC ...)
2. **Dialogue**: the dialogue score, graded by the Black List, PAGE and BBC Writers; arbiters weigh dialogue for
   screenplay credit. (10: AFI, BBC, the Black List, ESCO, France Travail, O*NET, PAGE, the WGA ...)
3. **Structure**: the structure score, graded by PAGE; arbiters weigh construction for screenplay credit. (6: Careers
   in Screen, France Travail, PAGE, UCLA, the WGA, WGA East)
4. **Plot**: the plot score, graded by the Black List and PAGE. (7: AFI, the Black List, CPNEF-AV, ESCO, O*NET, PAGE)
5. **Theme**: the theme score, graded by the Nicholl readers, PAGE and Screen Australia; a factor in "Story by".
   (7: the Black List, O*NET, PAGE, Screen Australia, USC, the WGA, Nicholl)
6. **Premise**: the premise score, graded by the Black List, PAGE and Screen Australia; it decides separated rights
   and "Created by" in television arbitration. (5)
7. **Setting**: the setting score, graded by the Black List. (4: the Black List, UCLA, the WGA)
8. **Visual Storytelling** ("an ability to tell a story using images and sounds"): how filmable the script reads,
   graded where a rubric names it (Austin: writing visually); it also lowers the production notes a director gives.
   (5: Careers in Screen, CPNEF-AV, dffb, Filmuniversität Babelsberg, France Compétences)
9. **Distinctive Voice**: the voice score, graded by the Nicholl readers, Austin, BBC Writers, the CMF's peer panels
   and Film Independent's selection; programmes and schools admit on it (NFTS, USC, AFI). (9)
10. **Research**: how authentic the script's world is (its setting and story scores where the world is a real one),
    and the days of research a script needs. (7: ABS, CPNEF-AV, ESCO, France Travail, O*NET, Québec, the BBC's
    Casualty posting)
11. **Screenplay Format**: whether the script is read at all: readers mark presentation (PAGE), the Nicholl rules and
    Austin's readers name standard format, and a script far off format is set aside. (7)
12. **Writing**: the writing's quality across every component (O*NET's top-rated skill for the occupation, 100 of
    100) and the pages a day a draft moves at. (7: ABS, O*NET, Québec, the National Careers Service, WGC, WorkBC,
    energy.gov)
13. **Synopsis** ("summarise stories"): the loglines, synopses and treatments that submissions, pitches and step deals
    ask for, scored where they are read (the treatment step; funders' story documents). (4: CPNEF-AV, ESCO, France
    Compétences, the National Careers Service)
14. **Revision** ("revise written material"): how much each rewrite raises the script's scores (`work.notes`). (5:
    AFI, France Compétences, France Travail, O*NET, the National Careers Service)

### Judging (read by `work.coverage` and `work.notes`)

15. **Story Critique**: the accuracy of the writer's own read of a draft (what the player is told about it before
    sending it out) and the quality of paid coverage. (6: ABS, AFI, Local 700's members, dffb, France Compétences,
    UCLA Extension)
16. **Critical Thinking**: how well notes are weighed: which to take, which to argue (`work.notes`). (5: LFS's
    admissions, O*NET, Québec, WorkBC, energy.gov)
17. **Innovation**: the ideas a writer has to start from: how many premises a period of thought yields, and their
    originality, which the readers grade. (5: France Travail, O*NET, the National Careers Service, Bamberg,
    energy.gov)

### Working (read by `work.writing` and `work.notes`)

18. **Time Management**: deadlines met (the deal's delivery periods); a late draft costs the writer the next step.
    (O*NET, Québec, WorkBC, NFTS; with "follow work schedule": ESCO, CPNEF-AV, berufsberatung.ch)
19. **Perseverance**: whether a draft is finished or abandoned, and how a writer carries on after a pass or a
    rejection. (4: berufsberatung.ch, O*NET, the National Careers Service, energy.gov)
20. **Taking Notes**: how a producer or executive rates working with the writer after notes, which decides being kept
    on, rehired, or replaced; labs select on it (Film Independent's Episodic Lab). (7: Film Independent, France
    Compétences, LFS, NFTS, the National Careers Service, the WGA's Screenwriters Handbook, berufsberatung.ch)

### People and selling (read by `career.selling` and `work.room`)

21. **Pitching**: a pitch meeting's outcome (a sale, an open assignment won). (7: AFI, CPNEF-AV, ESCO, France
    Compétences, LFS, O*NET, the National Careers Service)
22. **Networking** ("develop professional network"): who the writer knows, which decides the meetings, reads and
    referrals that come. (7: berufsberatung.ch, CPNEF-AV, ESCO, France Compétences, France Travail, NFTS, the National
    Careers Service)
23. **Promotion** ("promote your writings"): the reach of a script once out (requests to read it) and of a writer's
    name. (4: ABS, ESCO, France Travail, O*NET)
24. **Persuasion**: the outcome of arguing a creative point (keeping a scene against a note) and of a negotiation the
    writer leads; the BBC's script editors and storyliners are hired on it. (5)
25. **Speaking**: how a writer comes across in meetings and in the room. (O*NET, Québec, the National Careers Service,
    WorkBC; with "communication and language skills": France Travail, LFS, NFTS, Bamberg)
26. **Social Perceptiveness**: standing in a writers' room (`work.room`). (4: energy.gov, O*NET, Québec, WorkBC)

### Knowing the trade

27. **Film Production Process**: how producible a script is: fewer production notes, and a budget a producer can make
    it for. (4: berufsberatung.ch, CPNEF-AV, ESCO, USC)

## What is still the owner's

- This cut (27 attributes) and the two outcomes taken out of it.
- How a life starts on them (all at a low number, or set by the background the owner has already kept: the family's
  trade, where you grew up), and what raises them: the research names what schools teach and what work builds, which
  `work.*` and the schools' courses would read.
- The order the engines are built in; the balance of every weight, which the owner has put later.
