# Building a SCUMM-Style Adventure Game in 2026: Code-First, Agent-Friendly, macOS

**Bottom line: build with Godot 4 + the Popochiu plugin.** It is the single option that satisfies all four of your hard priorities at once — it is free and MIT-licensed, runs fully natively on macOS Apple Silicon (both the editor and the exported game), stores 100% of your project in human-readable text files a coding agent can read and write (GDScript `.gd` plus text scenes `.tscn`/`.tres`), and hands you the classic SCUMM plumbing — rooms, hotspots, walkable areas, inventory, dialogue trees, save/load, and a ready-made LucasArts 9-verb GUI — essentially for free.

### TL;DR
- **Best fit: Godot 4 + Popochiu (stable release 2.1.0, targeting Godot 4.6).** Free/MIT, native macOS incl. Apple Silicon (editor *and* runtime), everything is plain-text GDScript + `.tscn` scenes, and it ships rooms/hotspots/walkable-areas/inventory/dialogue plus 2-click, Sierra, and LucasArts 9-verb GUI templates out of the box. It is the cleanest resolution of the code-first-vs-SCUMM-for-free tension.
- **The tension you flagged is real:** the most SCUMM-complete mature tool (Adventure Game Studio) has an officially **Windows-only editor** and a monolithic XML project file that are hostile to a macOS agent workflow, while pure code-first web frameworks (Phaser/TypeScript) are perfectly agent-friendly but give you almost no adventure semantics for free. Godot-based plugins sit precisely in the middle.
- **Ranked for your priorities:** (1) Godot 4 + Popochiu; (2) Godot 4 + Escoria (agent-friendly but perpetually pre-release/alpha); (3) PowerQuest for Unity (code-first-ish, but Unity's binary project format and weight hurt); (4) Ren'Py (excellent VN-hybrid, weak on true SCUMM walk/verb mechanics); (5) from-scratch Phaser/TypeScript (max agent freedom, max infrastructure work). AGS, Visionaire, and Adventure Creator are capable but GUI-first and/or macOS-editor-constrained.

### Key Findings

**The central tradeoff.** You want four things that historically pull against each other: (a) SCUMM semantics for free, (b) a code-first workflow, (c) AI-agent-friendly plain-text project files, and (d) macOS. The tools that give the most genre plumbing for free — AGS, Visionaire, Adventure Creator — are GUI-first and store logic in editor-bound formats (AGS's `Game.agf` XML with embedded scripts; Unity's binary/YAML scenes and prefabs; Visionaire's `.ved`). The tools that are purely code-first and agent-transparent (Phaser, Löve2D) give you almost nothing genre-specific for free. **Godot-based adventure plugins are the best compromise:** Godot saves scenes as human-readable `.tscn` text and logic as `.gd` GDScript, and Popochiu/Escoria layer genuine SCUMM semantics on top.

**Why plain-text project files matter for an agent.** A coding agent like Claude Code excels at reading and writing plain-text source it can diff and reason about. Godot's `.tscn`/`.tres`/`.gd`, Ren'Py's `.rpy`, PowerQuest's C# `.cs`, AGS's `.asc`/`.ash` scripts, and Phaser's `.ts`/`.js` are all agent-writable. The hostile cases are Unity's opaque scene/prefab assets (an agent can edit C# but struggles to wire scenes) and AGS's monolithic `Game.agf` XML, which bundles game structure and even dialog scripts into one editor-managed file — the AGS team itself has open issues to split dialog scripts out and to build command-line tooling.

**macOS status by tool (editor / runtime; Apple Silicon):**
- **Godot (Popochiu/Escoria):** Editor and runtime both native on macOS including Apple Silicon. ✅
- **AGS:** Editor is **Windows-only** — the official repo README states verbatim: "unlike the runtime engine, AGS Editor is only supported on MS Windows (and Windows emulators such as WINE)." The runtime engine is cross-platform (macOS builds exist via a shell app). On a Mac you must run the editor under Wine/CrossOver or a VM; Apple Silicon adds a translation layer.
- **PowerQuest (Unity):** Editor and runtime run on macOS (Unity supports Apple Silicon). ✅ but Unity is heavy.
- **Adventure Creator (Unity):** macOS editor + runtime supported. GUI-first.
- **Visionaire Studio:** Native macOS editor shipping both ARM64 and x86 binaries; exports to macOS. ✅ GUI-first.
- **Ren'Py:** Native macOS including Apple Silicon, editor and runtime. ✅
- **SLUDGE:** Cross-platform historically, but macOS builds are no longer maintained; effectively dormant.
- **Phaser / web:** Runs anywhere with Node + a browser; fully macOS-native. ✅

**How much SCUMM comes "for free":**
- **AGS:** Almost everything — pathfinding, walkable areas, save/load, inventory, dialogue, verb-coin and Sierra GUIs. Highest "for free" score — but Windows editor.
- **Popochiu:** Rooms, characters, props, hotspots, multiple walkable areas, regions/markers, inventory, dialogue trees, save/load, and three GUI templates including a LucasArts **9-verb** and a **Sierra** template. Very high.
- **Escoria:** Rooms, items, inventory, character movement, room transitions, dialogue, save system; ships a 9-verb keyboard UI and a simple-mouse UI. High — but see maturity caveat.
- **PowerQuest:** Full AGS-like set — LucasArts 9-verb, Sierra parser, and modern GUI templates; dialogue trees; walkable areas/pathfinding; inventory; patch-friendly save/restore; camera/parallax. High.
- **Ren'Py:** Strong dialogue/menus/branching and screens/imagemaps for hotspots; inventory and character walking are **not** built-in and must be scripted. Medium-low for true SCUMM.
- **Phaser/Löve2D:** Nothing genre-specific for free; you build all the plumbing.

**Scripting-language / agent fit.** Popochiu and Escoria use GDScript (Python-like, highly agent-friendly) plus text scenes; Escoria adds its ASHES DSL (plain text, GDScript/Python-flavored). PowerQuest uses a simplified script layer that saves to native C#. AGS uses C-like "AGS Script" (`.asc`/`.ash`). Ren'Py uses its Python-based DSL in plain-text `.rpy`. All fall inside the zone where coding agents perform strongly (Python, GDScript, C#, JS/TS, Lua).

### Details

**1. Godot 4 + Popochiu — TOP RECOMMENDATION.**
Popochiu is a Godot editor plugin plus runtime, explicitly "inspired by Adventure Game Studio and PowerQuest," MIT-licensed and free. Its official README/docs state: "The latest stable public release is Popochiu 2.1.0, which targets Godot 4.6," and the project is "now maintained by Carenalga and StickGrinder." It organizes games into Rooms containing Characters, Props, Hotspots, multiple walkable areas, regions and markers, with built-in Inventory and Dialogue systems. Version 2.1 ships three production-ready GUI templates: 2-click context-sensitive (Deponia-style), **9-Verbs (LucasArts)**, and **Sierra**. The scripting API is GDScript with autocomplete — e.g. `E.run([...])` to queue actions, `C.Player.walk_to_clicked()`, `I.LaserPistol.add()`, `R.Kitchen.FirstTimeVisited`.
- *Agent-friendliness:* Excellent. Everything is GDScript and `.tscn`/`.tres` text. An agent can create rooms, wire hotspots, write interaction scripts, and edit dialogue directly in source. The Popochiu dock is convenient for a human but not strictly required for an agent that understands the file conventions.
- *macOS:* Full native support including Apple Silicon (it's Godot).
- *Maturity/community:* Actively maintained by Mateo "Carenalga" Robayo Rodríguez and Paolo "StickGrinder" Pustorino plus community; 2.0 shipped after ~14 months of work; 2.1 added 46 fixes/features and rebuilt the docs on Godot-docs tooling. Community is far smaller than AGS's, and video tutorials lag the current version (a noted weakness).
- *Verdict:* Best balance of code-first + agent-friendly + SCUMM-for-free + macOS. Start here.

**2. Godot 4 + Escoria.**
Escoria is the older MIT-licensed Godot point-and-click framework, originally built for *The Interactive Adventures of Dog Mendonça and Pizzaboy*. It handles character movement, room transitions, item relationships, inventory, and dialogue, and ships a 9-verb keyboard UI. It uses a dedicated plain-text scripting language now called **ASHES** (replacing the old ESCscript), currently stored in `.esc` files (a `.ash` extension is planned but not yet active), designed to feel familiar to GDScript/Python users. It targets Godot 4 (the docs banner: "Escoria now works with Godot 4!").
- *Agent-friendliness:* Very good — ASHES scripts and `.tscn` are plain text.
- *macOS:* Native (Godot).
- *Maturity caveat (important):* Escoria's Godot 4 port has been in **alpha for years with no stable 4.0.0 release**. The escoria-core release feed stalled at **v4.0.0-alpha.154** (tagged by Julian Murgia / StraToN, 2022) while development continued on `main` (commit activity into April 2025); the escoria-demo-game repo continued issuing alpha releases (reaching v4.0.0-alpha.314 in Feb 2026), with only a single beta pre-release and still no stable 4.0.0. Lead maintainer is Duncan Brown (@DevOrionGames), with Julian Murgia (@StraToN) also principal. It is actively maintained but not production-stable, and the maintainer's own framing has been "down to bug fixes and then a proper beta release."
- *Verdict:* Strong conceptual fit and agent-friendly, but Popochiu is more polished and closer to stable today. Choose Escoria only if you specifically prefer its declarative room/event DSL and can tolerate pre-release status.

**3. PowerQuest (Unity).**
A Unity toolkit from Powerhoof — a two-person Melbourne studio (Dave Lloyd, programming; Barney Cumming, art) — explicitly offering "the fast workflow and ease-of-use of AGS but with the power of Unity." It is "name your own price" (effectively free) on itch.io; the latest stable is **v0.20.4 ("Drift 'em up"), released Jan 30, 2026**. Powerhoof states "Over 80 PowerQuest games have been released so far," including the developer's own commercial title **The Drifter** (built with PowerQuest; released July 17, 2025 on PC, with Nintendo Switch/Switch 2 following June 22, 2026). Feature-complete SCUMM support: the LucasArts **9-Verb** template (introduced in v0.12.4, Feb 16, 2021), Sierra parser, and modern GUI templates; dialogue trees; walkable areas/pathfinding; inventory; patch-friendly save/restore; camera/parallax. Crucially, **scripts save to native Unity C#**, with a simplified script-editor layer (`E.`, `C.`, `R.`, `I.`, `P.`, `H.` accessors) reminiscent of AGS.
- *Agent-friendliness:* Mixed. The C# scripts are agent-writable, but Unity stores scenes, prefabs, and the Quest object data in Unity-managed assets an agent cannot easily manipulate outside the editor. You'd rely on the GUI for setup and the agent for scripting.
- *macOS:* Unity editor + builds run on macOS including Apple Silicon.
- *Verdict:* Excellent if you already live in Unity, but Unity is (in the author's own words) "a huge beast to tame," and its project format is the least agent-friendly of the code-first options.

**4. Ren'Py.**
Free, cross-platform including macOS Apple Silicon (editor and runtime both native; Apple Silicon support added in the 8.x line). Scripts are plain-text `.rpy` (a Python-based DSL) — very agent-friendly, and `_ren.py` files even allow editing in standard Python editors. Ren'Py is **visual-novel-first**: dialogue, menus, branching, and screens/imagemaps (hotspots) are trivial and first-class. But **true SCUMM mechanics are not built-in**: character walking, walkable areas, verb-object interaction, and inventory must be hand-built (community sample code exists). Forum consensus: hotspots and simple point-and-click are easy; inventory is "intermediate but not terribly difficult"; irregular hotspots and full adventure mechanics are where Ren'Py fights you (imagemaps are "extremely inflexible" for complex designs).
- *Verdict:* The right choice only if your game is dialogue-heavy with light poking-around. For a walking-character, verb-driven SCUMM game you would reimplement much of the plumbing — contrary to your "for free" goal.

**5. Adventure Game Studio (AGS).**
The most mature, most SCUMM-complete free tool: it "does all the donkey work — load/save, pathfinding, scrolling rooms," with classic Sierra and Verb Coin templates. Open-source (Artistic License 2.0), the largest community, deep documentation. Its script is C-like AGS Script (`.asc`/`.ash`), which is agent-writable text.
- *Two hard problems for your workflow:* (a) The **editor is officially Windows-only**; on macOS you must use Wine/CrossOver or a VM, and there is a documented history of the editor crashing (SIGSEGV) under Wine. The runtime engine is cross-platform. (b) The project is a monolithic `Game.agf` XML that bundles structure and even dialog scripts; while room scripts are separate `.asc` files, much of the game state is editor-managed XML that is clumsy for an agent.
- *Verdict:* A superb engine but the wrong fit for a macOS, agent-first, GUI-avoidant workflow. Consider it only if you relax the macOS/agent constraints — in which case it is the genre's gold standard.

**6. Visionaire Studio (GUI-first).**
Commercial engine behind Daedalic titles and *Paradigm*; native macOS editor (ARM64 + x86 binaries), exports to macOS and many platforms. Built-in dialogue, inventory, and point-and-click systems, with Lua 5.4 scripting for extension. Its project file `.ved` is XML (editable in principle). But it is explicitly a **no-coding, visual-scripting GUI-first tool** — the opposite of your preference; Lua is a secondary layer, not the primary workflow.
- *Verdict:* Flag as GUI-first. macOS support is good, but it doesn't match your code-first, agent-driven goal.

**7. Adventure Creator (Unity, GUI-first).**
An $80 Unity plugin (one license per seat) by Chris Burton; the most polished "SCUMM-for-free" Unity option — inventory, dialogue, conversations, navigation, QTEs, save/load "just a few clicks away," with macOS editor + runtime supported. But its whole selling point is **visual scripting (ActionLists) with no code required** — GUI-first by design, and Unity's opaque project format compounds the agent problem.
- *Verdict:* Flag as GUI-first. Ideal for non-coders; wrong for an agent-driven code-first flow.

**8. ScummVM / SCUMM authoring.**
ScummVM is an **interpreter/runtime for playing classic games, not an authoring tool** — "a collection of interpreter implementations for 2D adventure games." There is no modern, supported SCUMM-compatible authoring path via ScummVM. (It has recently added the ability to *run* AGS and SLUDGE games — that is preservation/playback, not authoring.) Do not consider it for building a new game.

**9. SLUDGE.**
An open-source, script-based adventure engine (LGPL) that produced *Out of Order*. Historically cross-platform including macOS, but the maintainers stated they could no longer provide Windows/Mac builds after the original maintainer left; the project is effectively dormant, and its games are now being absorbed into ScummVM for preservation. Script-based (agent-friendly in principle) but the maintenance risk is prohibitive.
- *Verdict:* Not recommended — dormant.

**10. Code-first / web frameworks (Phaser, Löve2D, DSLs).**
- **Phaser (JS/TS):** Maximum agent-friendliness — pure text `.ts`/`.js`, native macOS, and coding agents are extremely strong in JS/TS. But there is **no mature, maintained SCUMM framework**; community options (`phaser-pnc`, various jam templates, ClickyPointy) are hobbyist, partial, and largely unmaintained. You would build rooms, walkable areas, verbs, inventory, and dialogue yourself — exactly the infrastructure you want to avoid. The upside: an agent can scaffold this quickly if you accept that tradeoff.
- **Löve2D (Lua):** Same story — agent-friendly language, no genre framework for free.
- **Adventuron:** A browser-based DSL, but it is a **text-adventure (parser) authoring system**, not a graphical SCUMM tool, and its editor is desktop-browser-only. Not a fit for graphical point-and-click.
- *Verdict:* Choose a from-scratch Phaser/TypeScript build only if you value total control and agent fluency over getting SCUMM semantics for free.

### Recommendations

**Stage 1 — Start with Godot 4 + Popochiu (this week).** Install Godot 4.6 and Popochiu 2.1 on your Mac (native Apple Silicon). Run the setup wizard and pick the 9-verb LucasArts GUI. Point your coding agent at the project directory — everything is GDScript + `.tscn`/`.tres` text it can read and write. Have the agent scaffold one room, one walkable area, two hotspots, one inventory item, and a short dialogue tree. **Success benchmark:** a walkable character, a working verb interaction, an inventory pickup, and a branching conversation running in the editor within a day or two. Hit that, and commit to Popochiu.

**Stage 2 — If Popochiu's workflow or docs frustrate you, evaluate Escoria** as an alternative Godot framework whose ASHES DSL may suit an agent well for event scripting. **Threshold to switch:** only if you specifically prefer a declarative room/event DSL over Popochiu's GDScript API *and* you can tolerate pre-release (non-stable) status. Otherwise stay on Popochiu.

**Stage 3 — Consider PowerQuest only if you outgrow Godot 2D** (e.g., you need Unity's rendering/shader pipeline or console porting). Accept that Unity's project format forces more GUI interaction and less pure-agent control. **Threshold:** a concrete technical need Godot cannot meet.

**Fallback — Phaser/TypeScript from scratch** if you decide agent-authorability trumps everything and you're willing to have the agent build the adventure framework itself. This maximizes code-first and agent-friendliness at the direct cost of SCUMM-for-free.

**Do NOT choose** AGS (Windows-only editor + monolithic XML), Visionaire, or Adventure Creator (both GUI-first) as your primary path given your stated priorities — though AGS remains the genre gold standard if you ever relax the macOS/agent constraints. Skip ScummVM (not an authoring tool) and SLUDGE (dormant) entirely.

**On agent-language fit:** GDScript (Popochiu/Escoria), C# (PowerQuest), and TS/JS (Phaser) are all in the zone where a coding agent performs strongly. GDScript's Python-like syntax and Godot's text scenes make Popochiu the best "the agent can touch everything" option among tools that *also* give you SCUMM semantics for free.

### Caveats
- **Popochiu's tutorials lag its releases**, and its community is far smaller than AGS's — expect to lean on the agent, the source code, and Discord rather than polished video courses.
- **Escoria is not yet stable** (perpetual alpha with only a single beta pre-release on Godot 4, no stable 4.0.0) — promising but risky for a production timeline.
- **Godot text scenes are "mostly human-readable," not a clean DSL** — an agent can edit `.tscn`, but very large scenes become verbose; the agent is most effective in GDScript and moderate-sized scenes, and some node wiring may still be easier in the Godot editor.
- **AGS macOS-editor workarounds (Wine/CrossOver) are unofficial and can crash** (documented SIGSEGV history under Wine); do not rely on them for a serious project.
- **A Ren'Py "SCUMM" build reimplements core mechanics** — going that route forfeits much of the "for free" benefit.
- **Verify PowerQuest's current Apple-Silicon behavior with a quick build test** before committing; it inherits Unity's support but was not independently confirmed here on ARM.
- **Tool versions and maintenance status move quickly** — re-check each project's release page before you start.