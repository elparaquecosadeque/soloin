# TODO / Ideas

Deferred work and ideas that came up while building Soloin, kept here instead of scattered across commit messages and chat history. Nothing here is committed to — pick items up as they become relevant.

## Publishing (in order — see HANDOFF.md's "Next Steps" for exact commands)

1. Publish `@gblp/music-theory` to npm first (`the-chords` and `@gblp/soloin` both depend on it).
2. Bump-publish `@gblp/soloin` (now `0.2.0` — new dependency + alternate-tunings feature).
3. Publish `the-chords` with its new `/soloin` route (deploy, no npm publish needed — it's the app, not a library).

## Feature ideas

- **Click-to-highlight relevant notes on the main fretboard, saved with "Save session" in the-chords.** Idea: once the key/scale is known, let the user click notes on the normal (non-Identify) fretboard to mark the ones that matter for the song they're composing, and have those marks travel with the session. Open decision: mark *notes* (every C on the neck) or *exact positions* (that C at fret 8)? Identify already marks exact positions. Soloin would also need to expose that state (a signal like `identifyMarks`) so the-chords can serialize it into `?s=` (see `session-codec.ts` there, versioned `v: 1`). The `selectable` mode of `SoloinFretboard` (input `selectable`, `selectedPositions` as `"string:fret"` keys, output `positionToggled`) built for Identify is the base to reuse.
- **Capo support.** Alternate tunings shipped; capo (shifting every fret by an offset) is a related but separate, smaller change — deferred to its own pass rather than bundled in with tunings.
- **Migrate circle-of-fifths onto `@gblp/music-theory`.** The extraction was deliberately single-consumer for now (see HANDOFF.md's "Key Decisions") — circle-of-fifths still uses its own static `KEYS[]` table for diatonic-chord/key logic. Worth revisiting once there's a concrete reason to keep both engines in sync, not just because the shared package now exists.
- **A real "composition flow" page in the-chords.** The integration that shipped is the same flat 4th-route pattern as the other 3 siblings (nav link + wrapper page) — deliberately, not the more ambitious guided walkthrough (rhythm guitar → solo guitar → bass notes as one chained UX) originally imagined. That's a real, novel design effort with no existing precedent in the-chords' codebase; it deserves its own dedicated session, not a footnote on this batch.
- **Per-chord alternate-scale suggestions for non-diatonic chords.** The diatonic check (`isDiatonic`) currently only flags that a chord like A7 doesn't belong to the detected key — it doesn't suggest what to play over it instead. A natural next step: for a flagged chord, suggest a scale that actually fits it (e.g. Mixolydian for a secondary dominant), shown as an alternate option specifically on that chord's tile rather than changing the shared key-wide scale.
- **Three-notes-per-string (TNPS) box system**, alongside the existing CAGED boxes. Another common fretboard-organization system (seen in the reference tool that motivated CAGED); deferred to keep the box-selector feature scoped to the one system first.
- **Diatonic-aware note speller.** `noteName()` currently renders every pitch class through one fixed sharp/flat table, never true per-scale-degree spelling (e.g. a scale that theoretically wants `Fb` shows `E` instead) — documented as an accepted simplification with a `ponytail:` comment in `pitch-class.ts` (now in the `@gblp/music-theory` repo). A real key-signature-aware speller would fix this, at the cost of real complexity.
