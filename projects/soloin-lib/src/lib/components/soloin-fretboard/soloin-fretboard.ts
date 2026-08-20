import { Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { type Note, mod12 } from '../../engine';
import type { FretRange } from './caged';

export interface ChordLayer {
  label: string;
  root: Note;
  tones: Note[];
  toneLabels: string[]; // parallel to tones — note names or degree labels, computed by the caller
  colorVar: string;
  diatonic: boolean; // whether this chord belongs to the detected/selected key
}

interface RenderDot {
  x: number;
  y: number;
  r: number;
  colorVar: string;
  label: string;
  isRoot: boolean;
}

// Standard 6-string guitar tuning, high string first (top row) to low string
// last (bottom row) — matches the visual convention of a fretboard diagram.
const STRINGS = [
  { label: 'E', open: 4 },
  { label: 'B', open: 11 },
  { label: 'G', open: 7 },
  { label: 'D', open: 2 },
  { label: 'A', open: 9 },
  { label: 'E', open: 4 },
] as const;
const FRETS = 12;

// Geometry constants, adapted from bass-notes' fretboard layout (ML/OPEN_W/
// FRET_W/STR_H/MT/MB) for 6 strings instead of 4.
const ML = 36;
const OPEN_W = 44;
const FRET_W = 56;
const STR_H = 48;
const MT = 24;
const MB = 36;
const W = ML + OPEN_W + FRETS * FRET_W;
const SVG_W = W + 16;
const SVG_H = MT + (STRINGS.length - 1) * STR_H + MB;

const dotX = (f: number): number => (f === 0 ? ML + OPEN_W / 2 : ML + OPEN_W + (f - 0.5) * FRET_W);
const dotY = (si: number): number => MT + si * STR_H;

const CENTER_Y = MT + ((STRINGS.length - 1) / 2) * STR_H;
const POSITION_MARKERS = [
  ...[3, 5, 7, 9].map((f) => ({ cx: dotX(f), cy: CENTER_Y })),
  { cx: dotX(12), cy: CENTER_Y - STR_H / 2 },
  { cx: dotX(12), cy: CENTER_Y + STR_H / 2 },
];

export const FRETBOARD_FONT = "'Segoe UI', Roboto, system-ui, -apple-system, sans-serif";

@Component({
  selector: 'soloin-fretboard',
  templateUrl: './soloin-fretboard.html',
  styleUrl: './soloin-fretboard.scss',
})
export class SoloinFretboard {
  readonly scaleNotes = input.required<Note[]>();
  readonly scaleLabels = input<string[]>([]); // parallel to scaleNotes
  readonly scaleRoot = input<Note | null>(null);
  readonly chordLayers = input<ChordLayer[]>([]);
  readonly cagedBox = input<FretRange | null>(null);
  readonly ariaLabel = input('Fretboard');

  readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  readonly fontFamily = FRETBOARD_FONT;
  readonly viewBox = `0 0 ${SVG_W} ${SVG_H}`;
  readonly stringLabelX = ML - 6;
  readonly stringLineX2 = W;
  readonly stringY1 = MT;
  readonly stringY2 = dotY(STRINGS.length - 1);
  readonly fretNumY = SVG_H - 6;
  readonly nutX = ML;

  readonly fretLines = Array.from({ length: FRETS + 1 }, (_, i) => ({
    x: ML + OPEN_W + i * FRET_W,
    isNut: i === 0,
  }));
  readonly fretNumbers = [0, 3, 5, 7, 9, 12].map((f) => ({ x: dotX(f), label: f }));
  readonly strings = STRINGS.map((s, si) => ({ label: s.label, y: dotY(si) }));
  readonly positionMarkers = POSITION_MARKERS;

  // ponytail: readability degrades past ~3 overlapping chord layers at one
  // fret/string (rings nest inward); fine for typical 3-4 chord progressions.
  // Upgrade path: fan the dots out instead of nesting them if that ever bites.
  readonly dots = computed((): RenderDot[] => {
    const scaleNotesArr = this.scaleNotes();
    const scaleLabelsArr = this.scaleLabels();
    const scaleRootPc = this.scaleRoot();
    const scaleLabelByPc = new Map<Note, string>();
    scaleNotesArr.forEach((n, i) => scaleLabelByPc.set(n, scaleLabelsArr[i] ?? ''));

    const layers = this.chordLayers();
    const box = this.cagedBox();
    const out: RenderDot[] = [];

    STRINGS.forEach((s, si) => {
      for (let f = 0; f <= FRETS; f++) {
        if (box && (f < box.start || f > box.end)) continue;
        const pc = mod12(s.open + f);
        const x = dotX(f);
        const y = dotY(si);

        const matches = layers
          .map((layer) => {
            const idx = layer.tones.indexOf(pc);
            return idx === -1 ? null : { layer, label: layer.toneLabels[idx] ?? '' };
          })
          .filter((m): m is { layer: ChordLayer; label: string } => m !== null);

        if (matches.length > 0) {
          matches.forEach((m, i) => {
            out.push({
              x,
              y,
              r: 13 - i * 4,
              colorVar: m.layer.colorVar,
              label: i === 0 ? m.label : '',
              isRoot: pc === m.layer.root,
            });
          });
        } else if (scaleLabelByPc.has(pc)) {
          out.push({ x, y, r: 10, colorVar: '--_chords-scale-note', label: scaleLabelByPc.get(pc)!, isRoot: pc === scaleRootPc });
        }
      }
    });

    return out;
  });
}
