# Designing a Great Star Trek: The Next Generation Point-and-Click Adventure — A Research-Backed Design Guide

## TL;DR
- **The single most important design decision is structural, not aesthetic: adopt the LucasArts "no death, no dead ends, no unwinnable states" philosophy and build the entire game around a Puzzle Dependency Chart (Ron Gilbert's tool), because the genre's most-cited failures — "moon logic," pixel hunting, backwards puzzles — are all symptoms of skipping that structural discipline.** For a TNG game specifically, this philosophy is also thematically correct: Star Trek is about diplomacy, ethics, and thoughtful problem-solving, not punishment.
- **Make the puzzles diegetic and ensemble-driven.** The best prior Trek adventures (25th Anniversary, Judgment Rites, A Final Unity) worked when away-team members' distinct abilities (Data's strength/computation, Geordi's VISOR, Worf's tactics, Troi's empathy, Crusher's medicine) mapped onto puzzle types and dialogue branches; they failed when they bolted on tedious real-time ship combat and step-by-step technobabble hand-holding. Multiple crew members should solve the same puzzle in character-specific ways.
- **Respect modern expectations without gutting challenge:** ship a built-in, context-sensitive hint system and optional casual/hard puzzle modes (as Thimbleweed Park and Return to Monkey Island did), a hotspot-highlight key, and a streamlined verb interface — but note experts genuinely disagree on interface philosophy and puzzle difficulty, so pick a lane deliberately and prototype it.

## Key Findings

1. **The foundational text is Ron Gilbert's essay "Why Adventure Games Suck (And What We Can Do About It)," published in the December 1989 issue of The Journal of Computer Game Design** (edited by Chris Crawford, the paper adjunct to the Computer Game Developers Conference) — which The Digital Antiquarian calls "probably the most influential ever written on the subject of adventure-game design." It codifies the anti-frustration principles that define "good" adventure design: a clear end objective, obvious sub-goals, no learning-by-dying, no backwards puzzles, no un-retrievable items, puzzles that advance the story, "reward intent," and non-arbitrary lock-and-key logic. Gilbert himself, reposting it in 2004, wrote: "As I read this some 15 years later, I'm not sure I agree with everything in here anymore" — a useful caution against treating any rule set as gospel.

2. **LucasArts vs. Sierra is the central philosophical divide.** LucasArts (Gilbert, later Schafer, Grossman, Fox, Falstein) built games you cannot lose; Sierra (King's Quest, Space Quest, Gabriel Knight) embraced death, dead ends, and save-scumming. The mainstream design consensus favors LucasArts, but there are serious defenders of the Sierra approach (death creates dramatic stakes; exploration-under-threat creates tension). This is a real, unresolved disagreement.

3. **The Puzzle Dependency Chart (PDC) is the single most recommended practical tool.** Invented by Gilbert for Maniac Mansion, refined with David Fox and Noah Falstein through Last Crusade and Monkey Island, it diagrams puzzles as a directed acyclic graph of dependencies (not a flowchart). Design backwards from the end of puzzle chains; aim for a "diamond" rhythm of expansion and contraction; use "bushy" parallel branches so a stuck player always has something else to do.

4. **The genre's cautionary tale is the "cat hair mustache" puzzle in Gabriel Knight 3**, dissected by Old Man Murray (Erik Wolpaw) in the essay "The Death of Adventure Games" (published September 11, 2000), where Wolpaw called the puzzle "genuinely deranged." It's the canonical example of "moon logic" — and notably, the puzzle was created by a producer (Steven Hill) after designer Jane Jensen's original was cut for budget, a lesson in how last-minute, unowned design decisions wreck a game's reputation. But the "death of adventure games" itself is contested: scholar Clara Fernández-Vara argues it's a North-America-centric myth, since the genre continued in Europe and has since flourished via indies.

5. **Prior Star Trek adventures are directly instructive.** 25th Anniversary and Judgment Rites (Interplay, TOS) and A Final Unity (Spectrum HoloByte/MicroProse, TNG) all "captured the feel" of the show through episodic structure, away missions, branching diplomatic dialogue, and character-specific abilities. Their recurring weaknesses: clunky, near-mandatory real-time ship combat; heavy technobabble that reduced early puzzles to step-by-step instruction-following; and thin character development.

6. **Modern best-practice titles show multiple viable paths.** Thimbleweed Park and Return to Monkey Island modernized the classic verb-driven model with built-in hint systems and difficulty modes. Wadjet Eye's Unavowed imported BioWare-style party companions and branching into point-and-click. Disco Elysium replaced item puzzles with skill-check dialogue and "skills as characters." Kentucky Route Zero and Norco largely abandoned puzzles for atmosphere and choice — a legitimate but polarizing direction.

## Details

### 1. Foundational design literature

**Ron Gilbert, "Why Adventure Games Suck" (1989).** Gilbert opens by explaining he wrote it while designing The Secret of Monkey Island. The core of the essay is "Gilbert's Rules of Thumb":
- **End objective needs to be clear** — the player should know what they're ultimately trying to accomplish; "nothing is more frustrating than wandering around wondering what you should be doing."
- **Sub-goals need to be obvious** — hook players by making at least the first sub-goal clear (he cites Ben Kenobi laying out Luke's journey early in Star Wars).
- **Live and learn** — a game should be completable "from beginning to end without 'dying' or saving the game if the player is very careful and very observant"; it's bad design to require death to learn.
- **Backwards puzzles** — "The backwards puzzle occurs when the solution is found before the problem." Ideally the crevice is found before the rope. Finding a solution before you understand the problem robs the player of the "aha."
- **"I forgot to pick it up"** — never require an item that can't be retrieved later; he calls the "players know to pick up everything" defense "a cop-out."
- **Puzzles should advance the story** — each solution should bring the player closer to understanding the story/goal.
- **Real time is bad drama** — use "Hollywood time, not real time"; give slack on timed puzzles and watch for intent (Indiana Jones grabbing his hat as the stone door falls).
- **Incremental reward** — the player needs to feel they're achieving.
- **Arbitrary puzzles** — solutions must make sense (not be obvious, just sensible): "Of course, why didn't I think of that sooner!"
- **Reward intent** — figure out what the player is trying to do; if it matches the game's goal, help it happen rather than forcing them to "second-guess the parser."
- **Unconnected events** — if six objects must be collected to open a door, there should be a reason those objects affect that door.
- **Give the player options** — don't "cage" the player linearly; think of puzzles as locked cages the free player chooses among.

**Bob Bates, "Designing the Puzzle" (GDC 1997) and Game Design: The Art & Business of Creating Games (2001).** Bates (Legend Entertainment; Infocom's Sherlock, Arthur) provides the most thorough taxonomy of puzzle types: ordinary/unusual use of objects, building puzzles, information puzzles, codes/cryptograms, "excluded middle" puzzles (set up a reliable cause-and-effect, then require the player to trigger it), "preparing the way," people puzzles (the most satisfying, because solving them teaches you about characters), dialog puzzles, timing puzzles, mazes (now cliché; avoid unless there's a twist), and "gestalt" puzzles (recognizing a general condition, e.g., the sundial in Moriarty's Trinity). His central maxim: "A good puzzle fits into its setting and presents an obstacle that makes sense. When the player solves it he knows why what he did worked." He also stresses feeding the player "little nuggets of information" so they circle in on solutions.

**Noah Falstein** (LucasArts, later Google Chief Game Designer) co-developed the PDC and delivered the definitive GDC 2013 talk "The Arcane Art of Puzzle Dependency Diagrams." Falstein's practical takeaways: avoid over-loading the chart with narrative; make branches "bushy" so stuck players have parallel tasks; design backwards from the climax; stretch a section by breaking one key into three sub-quests, or ease a hard section by adding alternative solutions. With Hal Barwood he ran "The 400 Project," an attempt to catalog game-design "rules of thumb" — but both men warn the rules are "more like guidelines," and Barwood explicitly rebels against the idea that following precise rules produces engaging games.

**The Sierra counterargument.** PopMatters and others make the case that death and dead ends aren't automatically inferior: terminal consequences create dramatic tension a villain otherwise lacks (it's "no accident that most LucasArts games are comedies"), and careful saving/exploration-under-threat is itself a form of engagement. This matters for a TNG game because Trek does have life-or-death stakes — the design question is whether to represent them with actual failure states or with narrative consequence.

### 2. Puzzle design theory

**What makes puzzles bad:** "moon logic" (solutions only the designer could intuit — the cat-hair mustache), pixel hunting (needle-in-a-haystack hotspot searches), backwards puzzles, un-retrievable items, unforeshadowed deaths, and arbitrary lock-and-key relationships. Notably, PopMatters points out the LucasArts "everything you need is somewhere accessible" model has its own failure mode: with a huge accessible world, "find the needle in the haystack" can be just as unpleasant as Sierra backtracking.

**What makes puzzles good:** internal logic, diegetic fit, clear goals presented before solutions, incremental reward, and multiple/alternate solutions. Gilbert notes in the Return to Monkey Island era that hint systems change the calculus: "Having hint systems means that if you make the puzzle just completely weird and obscure, people just go to the hint system" — i.e., obscure puzzles get bypassed, so they're not worth building.

**The PDC in practice (Thimbleweed Park blogs).** Gilbert's team designed the main-story puzzles first into "a glorious puzzle dependency chart," kept character-specific arcs mostly optional, split the game into acts (each ending in a bottleneck that gives a sense of completion and lets you cull inventory), and confirmed "every room in the game should have a purpose" — though David Fox adds it's fine for some rooms to exist purely for story/ambiance. Gilbert also notes the tool struggles to represent alternate/optional solutions cleanly, so he charts only the main puzzles. Tooling: he uses OmniGraffle; free alternatives include yEd (used in the Day of the Tentacle dependency-graph analysis).

**Hint systems and difficulty pacing.** Two proven models:
- Thimbleweed Park's in-fiction hint line ("HintTron 3000") — call a number from an in-game phone (dial 4468/"HINT") for free, context-sensitive, spoiler-managed hints, plus per-character to-do lists. Gilbert added this via a post-launch patch after "the lack of hints was widely criticized by some of the more casual press," noting it becomes "increasingly important" on casual platforms like iOS and Android.
- Return to Monkey Island's two upfront modes: **Casual** ("All the story and all the fun but with casual puzzles for the busy on-the-go player") and **Hard** ("More puzzles! Harder puzzles! The full monkey! For the pro-adventure gamer who wants it all."). Casual mode removes steps from larger puzzles and adds control tutorials, but the story is identical. Both modes include an in-fiction Hint Book Guybrush carries — deliberately tempting ("Murray! Just take one!").

### 3. Modern best practices and UI/UX

**Interface: the genuine, unresolved debate.** The historical evolution ran text parser → full verb interface (Maniac Mansion/Monkey Island's 9–12 verbs) → verb-cursor → simplified cursors (Full Throttle) → single context-sensitive cursor → "no cursor" 3D. Positions:
- Frictional Games argues verb lists became "the boring task of testing every word against every object," and that a single context-sensitive interaction can *increase* immersion.
- Others (e.g., the ZORPEK/Boneyard devlog) defend the 9-verb interface as "the perfect middle-ground between possibility space and convenience," valuing the deliberate experimentation of choosing HOW to interact.
- Gilbert deliberately brought verbs back for Thimbleweed Park; most modern commercial games (Wadjet Eye, Daedalic) use streamlined context-sensitive cursors with a look/interact split.

**Recommendation for TNG:** a streamlined context-sensitive interface (interact / examine / talk, plus tricorder-scan as a signature Trek verb) with a hotspot-highlight key, rather than a full 9-verb bar — but this is a judgment call worth prototyping both ways.

**Accessibility conventions now expected:** built-in hint systems, hotspot highlighting (hold spacebar to reveal interactive objects, standard in Daedalic titles and built into engines like Adventure Creator as "FlashHotspots"), difficulty/casual modes, subtitles, and the ability to skip dialogue/cutscenes. Modern audiences, per Gilbert, will "jump over to the web and read a walkthrough" if you don't provide hints.

**Companion/party mechanics — Unavowed.** Dave Gilbert built Unavowed as a point-and-click with "BioWare-style" party companions, character creation, and non-linear structure (do New York boroughs in any order, then branch back to linear). He designed each section "four or five times for all of the party combinations" — a direct, modern precedent for TNG away-team switching, and a clear warning about the combinatorial content cost.

**Dialogue-driven design — Disco Elysium.** Combat is replaced by skill checks and dialogue trees; its 24 skills (split across four attributes — Intellect, Psyche, Physique, Motorics, six each) are personified "characters" that interject. Crucially, **failed checks produce interesting outcomes rather than roadblocks**. White checks are retryable; red checks are one-shot and permanent. This is the strongest modern template for turning TNG's ensemble and its ethical/technical debates into mechanics.

**Puzzle-light narrative games — Kentucky Route Zero, Norco, Gone Home.** KRZ has "no traditional puzzles"; its designers deliberately shifted from puzzles to "mysteries" with no "right answer," using the dialogue tree to set tone rather than gate progress. This is influential and critically adored but polarizing (some reviewers find it dull). Norco keeps light puzzles but some critics feel they "pull you out of the experience." Fernández-Vara's synthesis: "solving puzzles is problem solving," so the choice isn't puzzles-vs-none but whether each challenge is seamless and diegetic.

### 4. Narrative design

**Diegetic puzzles and "narrative gating."** Best practice is puzzles that a character in the fiction would recognize as a real task; use puzzle completion to gate/pace story beats. Frictional's "4-Layers" narrative design approach (mechanics → tactics/puzzles → narrative → the player's overall journey) argues for streamlining: minimize steps so players don't drop out of the story, avoid major progression blocks in story-first games, and cites the GK3 cat-hair puzzle as the canonical anti-example. Academic work (Fernández-Vara's dissertation) frames adventure puzzles as mechanics for advancing plot and understanding the world.

**Dialogue systems.** Options range from classic branching trees (Monkey Island) to dialogue-as-primary-gameplay (Disco Elysium). For Trek, dialogue puzzles (Bates' category) and skill-gated conversation (Disco's model, where a high-empathy Troi or high-logic Data unlocks different lines) are the natural fit. Insult Sword Fighting in Monkey Island is the classic proof that a dialogue mechanic can be a puzzle and character comedy simultaneously.

**Pacing via acts.** Gilbert's three-act structure with bottlenecks (Act 1 = fast onboarding of characters; Act 2 = the "meat," most puzzling; Act 3 = fast wrap-up) maps naturally onto a TNG multi-part episode or season-finale arc.

### 5. Star Trek–specific insights

**A Final Unity (released June 30, 1995, TNG).** Widely regarded as the best Trek adventure and the closest to "an interactive TNG episode"; it sold 500,000 copies by 1996 and was a runner-up for Computer Gaming World's 1995 "Adventure Game of the Year" (won by I Have No Mouth, and I Must Scream). What worked: full original cast voicing, series-accurate music and cutscenes, a story overseen by TNG writer Naren Shankar (with Nebula-nominated author Stephen Goldin on staff), branching diplomatic outcomes, and **selectable away teams with character-specific abilities** (Data's android strength; Geordi's VISOR revealing what a tricorder can't; Troi's empathy; and notably, some puzzles solvable by different crew in-character — e.g., either Geordi OR Troi can solve a singularity-drive puzzle, each citing their own canon backstory). What didn't: a "convoluted," near-unusable real-time ship-combat/navigation system (best delegated to Worf/Geordi and otherwise avoided), an opening that funnels players straight into that terrible combat, and a heavily technobabble first mission that reduced puzzles to following a scientist's step-by-step instructions (inventory items like "plasma shunt, flux router, wave converter"). Reviewers also found the crew "stay pretty much the same from start to finish" — thin character arcs.

**25th Anniversary and Judgment Rites (1992–93, TOS).** Structured as episodic away missions in the point-and-click style; Judgment Rites is considered superior for its writing, interconnected story arc, toned-down/optional combat, and — critically — expanding the playable away team beyond Kirk/Spock/McCoy to give Scotty, Uhura, Sulu, and Chekov distinct roles. Both games score players on handling missions "in a manner befitting a Star Fleet officer," rewarding diplomacy over violence, and let you interact richly with the environment via eyes, medical tricorder, and science tricorder — a strong, Trek-authentic verb set. Judgment Rites pointedly avoided ending on a hard boss battle, instead resolving with conversation-based "tests of worthiness" — more faithful to Trek's spirit.

**How to capture TNG's tone in mechanics:**
- **Diplomacy over combat:** score/branch on peaceful, Prime-Directive-respecting solutions; make phasers primarily tools (as A Final Unity did), not weapons. Avoid mandatory real-time combat — it was the most-criticized element of every prior Trek adventure.
- **Ethical dilemmas:** use Disco-style skill/character-gated dialogue and multiple-valid-outcome design so moral choices have consequences without "game over." A Final Unity's choices mostly funneled to the same result (a weakness) — modern branching (Unavowed) shows how to do it with real divergence.
- **Ensemble/party switching:** map away-team members to puzzle and dialogue types — Data (computation, strength, database/technobabble), Geordi (engineering, VISOR sensing), Worf (tactical/security assessment), Troi (empathic reads on NPCs, detecting deception — a natural Disco-style "sense motive" mechanic), Crusher (medical), Picard/Riker (command, diplomacy). Give multiple characters valid but different solutions to the same obstacle to reward team composition and replay, exactly as A Final Unity did with Geordi/Troi.
- **Technobabble as puzzle flavor, not substance:** the lesson from A Final Unity's first mission is that technobabble must decorate a puzzle whose underlying logic is clear, not replace it with jargon-labeled fetch steps.

**A caution on content cost:** ensemble-specific solutions multiply content (Unavowed's "design each section four or five times"). Budget for it or constrain the number of characters with unique puzzle interactions per scene.

### 6. Practical resources

**Reading/talks:**
- Ron Gilbert, "Why Adventure Games Suck" (grumpygamer.com) and "Puzzle Dependency Charts" (grumpygamer.com); the Thimbleweed Park dev blog archive (blog.thimbleweedpark.com).
- Noah Falstein, "The Arcane Art of Puzzle Dependency Diagrams" (GDC 2013, on GDC Vault / Internet Archive).
- Bob Bates, "Designing the Puzzle" (GDC 1997) and Game Design: The Art & Business of Creating Games.
- The Digital Antiquarian (filfre.net), "The 14 Deadly Sins of Graphic-Adventure Design."
- Old Man Murray, "The Death of Adventure Games" (historical/critical context on moon logic).
- Clara Fernández-Vara: Introduction to Game Analysis, her PhD dissertation on adventure games, and "The Death of Adventure Games That Never Was" (contrary viewpoint).
- Game Maker's Toolkit video on point-and-click puzzle design; the curated "Adventure-Games-Design-Tools" GitHub list (vmpajares).

**Tools/engines:**
- **Adventure Game Studio (AGS):** the genre standard; powers Wadjet Eye's catalog (Blackwell, Gemini Rue, Technobabylon, Unavowed). Free, mature, 2D-focused.
- **Adventure Creator (Unity):** visual scripting, no-code option, built-in hotspot-flash; good for teams wanting Unity's portability/shaders.
- **PowerQuest (Unity):** by Powerhoof; replicates AGS workflow inside Unity with hot-reload and better text export; positioned as the bridge for AGS fans wanting Unity's reach.
- **Godot:** increasingly used; no dominant dedicated adventure plugin, but Escoria and community templates exist.
- Charting: OmniGraffle (Gilbert's choice, Mac), yEd (free, cross-platform).

**Communities:** the AGS forums, the Adventure Game Studio Discord, AdventureX (narrative-games conference), the Thimbleweed Park forums, and r/adventuregames.

## Recommendations

**Stage 1 — Set structural guardrails before writing a line of dialogue.**
1. Adopt the LucasArts no-death/no-dead-end/no-unwinnable-state rule as a hard constraint. Represent Trek's stakes through narrative consequence and branching, not failure states. (Benchmark to revisit: if playtesters report the game feels stakes-free or "on rails," selectively reintroduce *foreshadowed, recoverable* consequences — never sudden death.)
2. Build a Puzzle Dependency Chart for the main story first, in OmniGraffle or yEd. Design backwards from each act's climax. Enforce the "diamond" rhythm and bushy parallel branches. Keep character-specific arcs mostly optional and off the critical path.

**Stage 2 — Prototype the two riskiest pillars: interface and ensemble mechanics.**
3. Build a vertical slice with a streamlined context-sensitive cursor plus a signature "tricorder scan" verb and a hotspot-highlight key. A/B test it against a fuller verb bar with real players before committing. (Threshold: if new players can't figure out basic interactions in the first 5 minutes without frustration, simplify further.)
4. Prototype one away mission where at least two different crew members solve the central obstacle in character-specific ways (e.g., Geordi via VISOR, Data via computation, Troi via empathy). Measure the content cost; if it's unsustainable, cap unique-solution puzzles to key story beats and use character dialogue flavor elsewhere.

**Stage 3 — Bake in modern accessibility and difficulty from the start (retrofitting is costly).**
5. Design an in-fiction, context-sensitive hint system (a "Computer, hint" query to the ship's computer is the perfect diegetic wrapper) with escalating, spoiler-managed hints.
6. Author Casual and Hard puzzle modes up front (Return to Monkey Island model): identical story, fewer steps in casual. This is far cheaper to build in than to add later.
7. Adopt Disco Elysium's failure philosophy for skill/character-gated dialogue: failed "checks" (e.g., a failed Troi empathic read or Data computation) should open different, interesting narrative branches, never hard-block progress.

**Stage 4 — Author for tone and test relentlessly for "moon logic."**
8. Make diplomacy and Prime-Directive-respecting solutions the highest-scored/most-rewarded paths; keep phasers as tools. Avoid mandatory real-time combat entirely — it sank every prior Trek adventure. If you include ship encounters, make them optional, skippable, or delegable.
9. Run "cold" playtests where testers verbalize their reasoning. Any puzzle a fresh tester calls "unfair" or solves only by exhaustive combination is moon logic — redesign so the goal is presented before the solution and the logic is diegetic.
10. Write technobabble as *flavor over clear logic*, never as the puzzle itself. If removing the jargon leaves no comprehensible puzzle, the puzzle is broken.

**Benchmarks that would change the plan:** if playtest completion rates without hints fall below ~60–70% on hard mode, either add more foreshadowing/clues or shift steps into casual mode; if ensemble-specific content is blowing the budget, reduce the roster of puzzle-relevant characters per scene; if the streamlined interface tests as "too shallow" with core adventure fans, add an optional verb-coin or examine layer.

## Caveats
- **Experts genuinely disagree on two core issues,** and you should treat both as design bets, not settled facts: (a) puzzle difficulty philosophy (LucasArts anti-frustration vs. Sierra dramatic-stakes), and (b) verb interfaces vs. streamlined context-sensitive cursors. There is no consensus "right answer"; Gilbert himself disavows parts of his own 1989 manifesto.
- **The "death of adventure games" is a contested narrative.** Treat claims that the genre "died" skeptically; Fernández-Vara persuasively argues it's an oversimplified, North-America-centric story and that the genre has thrived among indies. Design for a real, existing audience.
- **Puzzle-light narrative design (KRZ/Norco) is critically celebrated but commercially and critically polarizing** — some players find these games "dull." Don't assume abandoning puzzles is a safe modern default; it's a strong artistic choice with real audience risk.
- **Licensing and canon constraints are significant unknowns** this report can't resolve: securing cast voices (a huge part of A Final Unity's appeal) and CBS/Paramount canon approval will shape scope and budget more than any design theory. Some source material here is enthusiast/secondary (fan wikis, forum posts, marketing pages); treat specific claims about prior Trek games' internals as well-corroborated but not primary-sourced.
- **Ensemble/branching content costs compound.** Unavowed's "design each section four or five times" is a real warning: party-based, character-specific, branching design can multiply your writing and scripting workload several-fold. Scope accordingly.
