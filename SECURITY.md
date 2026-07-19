# Security

Membrillo is a browser game engine. This document states its **trust model**
plainly, so you can decide what you're taking on when you build a game with it,
play one, or host someone else's.

The short version: a story is **data**, and Membrillo renders that data safely
(as text and canvas pixels, never as HTML or code). But a story's *drawing* —
`paint/index.ts`, and the browser-test `drive/*.mjs` — is **code**, and code
runs with the full authority of wherever it runs. So the one question that
decides your risk is: **whose code are you running, and on whose origin?**

## The trust model is bidirectional

- **Playing a game = trusting its author.** Loading a Membrillo game runs the
  author's painter JavaScript in your browser, exactly as visiting any website
  runs that site's scripts. The browser's same-origin sandbox bounds the
  damage (that code can't read your files, or another origin's data — only its
  own origin's `localStorage`, i.e. the saves). This is the normal web trust
  you already extend to every page you open; Membrillo neither adds to it nor
  removes it.

- **Hosting a game = the author's code runs on your origin.** If you serve a
  story whose painter you did not write — a community submission, a merged
  pull request, a "load any story" viewer — that painter is **arbitrary code
  executing under your origin**: your `localStorage`, your cookies, requests
  as you. This is the case that matters, and it is easy to walk into because
  the engine deliberately separates story *data* from drawing *code*.

The engine's job is to keep **story data** safe to treat as hostile, and to
make **painter code** an explicit boundary you choose to trust or sandbox.

## What the engine guarantees (story data is safe as text)

- **No HTML injection.** Every piece of story-controlled text — scene and
  dialogue lines, item and character names, titles, descriptions, objectives,
  the log — reaches the DOM only via `textContent`/`append(string)`, or is
  drawn on the canvas with `fillText`. There is **no** path from story JSON to
  `innerHTML`, `insertAdjacentHTML`, `document.write`, or a `style` attribute.
  So a story authored by a stranger can be *rendered* without becoming script.
- **No dynamic code from data.** The engine never `eval`s or `new Function`s
  anything. Story logic is a fixed declarative vocabulary (flags, items,
  companions, ordered rule buckets) the fuzzer can exhaustively check.
- **Strict Content-Security-Policy on builds.** Games built with the shared
  Vite config ship a `default-src 'self'` CSP: same-origin scripts, styles,
  fonts, and images only (`data:` for the inline favicon), `object-src 'none'`,
  no inline script, no `eval`, no external hosts. A deployed game cannot be
  turned into a script-injection or exfiltration vector even if it renders
  untrusted story text. (Clickjacking defense — `frame-ancestors` /
  `X-Frame-Options` — is *not* included: it's ignored in a `<meta>` tag and
  needs an HTTP response header, which a static host like GitHub Pages doesn't
  let us set. Add it at your host if you embed games in frames.)
- **Minimal surface.** Zero runtime dependencies. No network at runtime (the
  game serves itself; nothing is fetched). No secrets. No system access.
  Persistence is browser `localStorage` only.

## Where the trust boundary actually is

- **`paint/index.ts` (painters) and `drive/*.mjs` (browser tests) are code.**
  They run arbitrary JavaScript — in the browser (painters) or under Node
  (drivers, via the offline tools). For a game author drawing their own
  story this is exactly as safe as any code they write. It is **not** safe to
  run someone else's painters on an origin you care about, or to run someone
  else's `drive`/`check` on a machine you care about, without treating it like
  any untrusted repository.
- **The offline tools execute story code.** `membrillo check` / `npm run fuzz`
  import the story's `paint/index.ts`; `membrillo drive` imports `drive/*.mjs`.
  Running a third-party story through the tools runs its code under your Node
  process. Review it, or run it in a container, as you would any untrusted
  package.
- **Same origin = shared storage.** Two Membrillo games deployed to the *same
  origin* (e.g. two paths under one `github.io` account) share that origin's
  `localStorage` — either can read or clobber the other's saves. Don't host
  mutually-distrusting games on one origin; give them separate origins or
  subdomains.

## If you want to load *untrusted* stories

Building a platform that ingests stories other people wrote (upload-your-
adventure, a gallery, a shared editor)? Then painter code is the whole problem.
In increasing order of safety:

1. **Accept data, not code.** Require declarative + image-asset stories only
   (no `paint/*.ts`), so a story is pure data. The engine already renders data
   safely; strip or refuse painter modules from untrusted sources.
2. **Sandbox the game** in an `<iframe>` on a **separate origin** (or a
   `sandbox`ed frame with its own storage), so an untrusted painter can't
   touch the host origin's storage, cookies, or DOM. This is the cheapest
   robust answer and fits the browser's model.
3. **Remove code entirely** with a declarative-only render mode — painters
   expressed as data/a restricted DSL, or compiled to WebAssembly with no host
   access — so an untrusted story carries no executable code at all. This is
   future work; it's the only option that makes untrusted painter *code* a
   non-issue rather than a sandboxed one.

## Reporting

Membrillo is a small open-source project. If you find a security issue, please
open an issue at <https://github.com/septract/membrillo/issues> (or, for
something sensitive, contact the maintainer listed there) rather than posting a
working exploit publicly.
