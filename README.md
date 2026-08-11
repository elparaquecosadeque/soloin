# Soloin

Angular 22 app that finds the scales fitting a chord progression or key, and shows exactly which notes to target on a 6-string guitar fretboard. Enter a progression like `Am, F, C, G` and Soloin detects the key, lists the scales that work over it, and highlights each chord's tones in a distinct color on top of the scale.

Also published as **`@gblp/soloin`** — an Angular component (plus a headless theory engine) you can drop into any Angular 22+ app.

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
| Fretboard visualization | 6-string standard-tuning SVG fretboard; scale notes shown dim, chord tones color-coded per chord |
| Theory engine | Real interval/pitch-class math (not hardcoded tables), exported headlessly alongside the component |
| Export | Download the fretboard as PNG or PDF, or copy a plain-text summary |
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

Or use the theory engine headlessly, without the Angular component:

```typescript
import { buildScale, buildChordTones, detectKey } from '@gblp/soloin';

buildScale(0, 'ionian');           // [0, 2, 4, 5, 7, 9, 11] — C major
buildChordTones(2, 'm7');          // [2, 5, 9, 0] — Dm7
detectKey(['Am', 'F', 'C', 'G']);  // { root: 0, mode: 'major' }
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
│   │   ├── engine/              # pitch-class, scale, chord, parser, key-detection modules
│   │   ├── components/soloin-fretboard/
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

Soloin is designed to integrate with [the-chords](https://github.com/elparaquecosadeque/the-chords) via the `@gblp/soloin` npm package, alongside Chord Finder, Circle of Fifths, and Bass Notes — that integration is a planned future phase, not part of this package.
