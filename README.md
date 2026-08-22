# Soloin

Angular 22 app that finds the scales fitting a chord progression or key, and shows exactly which notes to target on a 6-string guitar fretboard. Enter a progression like `Am, F, C, G` and Soloin detects the key, lists the scales that work over it, and highlights each chord's tones in a distinct color on top of the scale.

Also published as **`@gblp/soloin`** — an Angular component you can drop into any Angular 22+ app. The theory engine itself lives in [`@gblp/music-theory`](https://github.com/elparaquecosadeque/music-theory), a separate framework-agnostic package Soloin depends on.

---

## Demo

Deployed to GitHub Pages: [`https://elparaquecosadeque.github.io/soloin/`](https://elparaquecosadeque.github.io/soloin/)

---

## Quick start

```bash
npm install
npm start
```

---

## Features

| Feature | Description |
|---------|-------------|
| Progression input | Comma-separated chords, e.g. `Am, F, C, G` — auto-detects the most likely key |
| Key input | Or pick a key directly from all 24 majors/minors |
| Scale suggestions | 7 major-scale modes (Ionian–Locrian), major/minor pentatonic, blues |
| Mosaic / Carousel views | Each progression chord gets its own compact fretboard (or step through them one at a time) instead of one board with every chord overlaid |
| Root marker | The root/tonic of every scale and chord is ringed on the fretboard, in every view |
| Tonic triad in Key mode | The I (or i) triad is highlighted within the full scale as a harmonic anchor |
| Notes / Degrees | Toggle every label between note names (C, D, E...) and scale degrees (R, 2, b3...) |
| Diatonic check | Chords that don't belong to the detected/selected key are flagged, on-screen and in exported text |
| Unrecognized-chord suggestions | A mistyped chord (e.g. `Dsu4`) is flagged instead of silently dropped, with a "did you mean" guess when confident |
| CAGED fretboard boxes | Narrow the whole neck down to one of the 5 classic movable hand positions (C-A-G-E-D), derived from real open-chord geometry (standard tuning only) |
| Alternate tunings | Standard, Drop D, DADGAD, Open G, Open D |
| Fretboard visualization | 6-string SVG fretboard; scale notes shown dim, chord tones color-coded per chord |
| Theory engine | Real interval/pitch-class math (not hardcoded tables) — [`@gblp/music-theory`](https://github.com/elparaquecosadeque/music-theory), usable standalone outside Angular too |
| Export | Download the fretboard as PNG or PDF (with a title band), or copy a plain-text summary |
| Themes | Fully CSS-variable driven — inherits dark/light theming from any host app with zero extra plumbing |
| i18n | English / Spanish UI copy |

---

## Scripts

```bash
npm start                # build the lib, then serve the demo app
npm run build            # production build of lib + demo app
npm run build:lib        # build @gblp/soloin to dist/soloin-lib
npm run build:gh-pages   # demo build with /soloin/ base href (GitHub Pages)
npm test                 # run the theory-engine and component tests
```

---

## Using as a library

Install from npm:

```bash
npm install @gblp/soloin
```

Import the standalone component:

```typescript
import { SoloinComponent } from '@gblp/soloin';

@Component({
  imports: [SoloinComponent],
  template: `<the-chords-soloin />`
})
export class AppComponent {}
```

Or use the theory engine headlessly (re-exported from [`@gblp/music-theory`](https://github.com/elparaquecosadeque/music-theory)), without the Angular component:

```typescript
import { buildScale, buildChordTones, detectKey, isDiatonic } from '@gblp/soloin';
// same functions are also importable directly from '@gblp/music-theory'

buildScale(0, 'ionian');                        // [0, 2, 4, 5, 7, 9, 11] — C major
buildChordTones(2, 'm7');                       // [2, 5, 9, 0] — Dm7
detectKey(['Am', 'F', 'C', 'G']);               // { root: 0, mode: 'major' }
isDiatonic({ root: 9, quality: 'dom7' }, { root: 0, mode: 'major' }); // false — A7 isn't in C major
```

Peer dependencies: `@angular/common` and `@angular/core` `^22.0.0`.

---

## Publishing

Publish is manual via GitHub Actions (`workflow_dispatch`). Add an `NPM_TOKEN` secret to the repo, then trigger the **Publish npm package** workflow from the Actions tab — or push a `v*` tag to also cut a GitHub Release.

---

## Project structure

```
soloin/
├── src/app/                    # demo shell app
├── projects/soloin-lib/        # publishable library
│   ├── src/lib/
│   │   ├── components/soloin-fretboard/  # fretboard rendering + CAGED box geometry + tunings
│   │   ├── export/               # PNG/PDF rasterization
│   │   └── soloin.ts             # SoloinComponent
│   ├── src/public-api.ts        # exports the component AND the engine
│   └── package.json             # @gblp/soloin
└── .github/workflows/
    ├── pages.yml                # GitHub Pages deploy
    ├── publish.yml               # npm publish (manual)
    └── release.yml                # GitHub Release on version tag
```

---

## Part of The Chords ecosystem

Soloin is integrated into [the-chords](https://github.com/elparaquecosadeque/the-chords) (as its `/soloin` route) alongside Chord Finder, Circle of Fifths, and Bass Notes.
