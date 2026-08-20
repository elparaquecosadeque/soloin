# TODO / Ideas

Deferred work and ideas that came up while building Soloin, kept here instead of scattered across commit messages and chat history. Nothing here is committed to — pick items up as they become relevant.

## Ecosystem

- **Integrate Soloin into `the-chords`.** The deliberate next phase after Soloin ships standalone: add a composition-flow page in [the-chords](https://github.com/elparaquecosadeque/the-chords) that walks rhythm guitar (`@gblp/chord-finder`) → solo guitar (`@gblp/soloin`) → bass notes (`@gblp/bass-notes`), the same way `@gblp/circle-of-fifths` is already wired in. Soloin's `language` input, `--chords-*` CSS-variable theming, and headless engine exports were built specifically so this integration needs no rework — see HANDOFF.md's "Key Decisions".
- **Extract a shared `@gblp/music-theory` package.** Soloin's engine (`buildScale`, `buildChordTones`, `detectKey`, `isDiatonic`, `parseChordName`...) is the only real interval-based theory engine in the family — the other 3 siblings each hardcode their own ad-hoc note model. Once the-chords integration is underway and more than one package wants this logic, pull it into its own package rather than duplicating it. Soloin's exports are already shaped for this to be a file-move, not a redesign.
- **First npm publish.** Configure an `NPM_TOKEN` secret (or npm trusted publishing) on the GitHub repo, then trigger the `Publish npm package` workflow — or push a `v0.1.0` tag to also cut a GitHub Release. Nothing code-side is blocking this.

## Feature ideas

- **Alternate tunings / capo support.** Soloin is standard-tuning-only (E-A-D-G-B-E) by deliberate v1 scope — the fretboard geometry (`soloin-fretboard.ts`) takes a single hardcoded `STRINGS` tuning. Extending it to accept a tuning parameter (drop D, DADGAD, open G...) and a capo offset is a contained change, not a rewrite.
- **Per-chord alternate-scale suggestions for non-diatonic chords.** The diatonic check (`isDiatonic`) currently only flags that a chord like A7 doesn't belong to the detected key — it doesn't suggest what to play over it instead. A natural next step: for a flagged chord, suggest a scale that actually fits it (e.g. Mixolydian for a secondary dominant), shown as an alternate option specifically on that chord's tile rather than changing the shared key-wide scale.
- **Three-notes-per-string (TNPS) box system**, alongside the existing CAGED boxes. Another common fretboard-organization system (seen in the reference tool that motivated CAGED); deferred to keep the box-selector feature scoped to the one system first.
- **Diatonic-aware note speller.** `noteName()` currently renders every pitch class through one fixed sharp/flat table, never true per-scale-degree spelling (e.g. a scale that theoretically wants `Fb` shows `E` instead) — documented as an accepted simplification with a `ponytail:` comment in `pitch-class.ts`. A real key-signature-aware speller would fix this, at the cost of real complexity.
