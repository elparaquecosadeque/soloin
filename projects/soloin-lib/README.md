# @gblp/soloin

Standalone Angular 22 component for finding the scales that fit a chord progression or key, visualized on a 6-string guitar fretboard with chord tones highlighted.

[View the package on npm](https://www.npmjs.com/package/@gblp/soloin)

```bash
npm install @gblp/soloin
```

```ts
import { Component } from '@angular/core';
import { SoloinComponent } from '@gblp/soloin';

@Component({
  imports: [SoloinComponent],
  template: `<the-chords-soloin [language]="'es'" />`,
})
export class App {}
```

`language` accepts `en` or `es` and defaults to `en`.

The theory engine is also exported headlessly, independent of the Angular component:

```ts
import { buildScale, buildChordTones, detectKey, parseChordName } from '@gblp/soloin';

buildScale(0, 'ionian'); // [0, 2, 4, 5, 7, 9, 11] — C major
detectKey(['Am', 'F', 'C', 'G']); // { root: 0, mode: 'major' }
```

Override the component theme from any ancestor with these inherited CSS variables:

```css
--chords-background;
--chords-surface;
--chords-text;
--chords-muted;
--chords-primary;
--chords-secondary;
--chords-highlight;
--chords-danger;
--chords-border;
--chords-on-primary;
--chords-nut;
--chords-string;
--chords-fret;
--chords-marker;
--chords-scale-note;
--chords-chord-color-1;
--chords-chord-color-2;
--chords-chord-color-3;
--chords-chord-color-4;
--chords-chord-color-5;
--chords-chord-color-6;
```

Build the package with `npm run build:lib`. The publishable Angular package is written to `dist/soloin-lib`.
