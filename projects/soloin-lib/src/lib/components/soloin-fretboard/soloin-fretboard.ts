import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { type Note, mod12, noteName } from '@gblp/music-theory';
import type { FretRange } from './caged';
import { type Tuning, TUNINGS } from './tunings';

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
  ring: number | null; // radius of the root ring, null = none
  colorVar: string;
  label: string;
  isRoot: boolean;
}

// One clickable fret position in `selectable` mode.
export interface FretPosition {
  string: number; // 0 = highest-pitched string (top row)
  fret: number;
  pc: Note;
}

interface SelectableDot {
  key: string;
  position: FretPosition;
  x: number;
  y: number;
  label: string;
  selected: boolean;
  inPreview: boolean; // in the previewed scale (only meaningful while a preview is active)
  isPreviewRoot: boolean;
  ariaLabel: string;
}

export const fretPositionKey = (string: number, fret: number): string => `${string}:${fret}`;

// Always 6 strings, high string first (top row) to low string last (bottom
// row) — matches the visual convention of a fretboard diagram. Which pitch
// class each string is open-tuned to is dynamic (see the `tuning` input);
// only the string COUNT is fixed, so geometry below can stay constant.
const STRING_COUNT = 6;
const FRETS = 12;

// Two looks, two sets of measurements. THEMED is the original layout
// (adapted from bass-notes' fretboard). PLAIN copies the riff card's fret
// window number for number — same cell size, string gap, margins, dot and
// type sizes — so every board in Soloin reads as the same drawing; the open
// strings are simply its first cell, as in a riff anchored at fret 0.
interface Look {
  ml: number; // left margin, up to the first fret line
  openW: number; // width of the open-string column
  fretW: number;
  strH: number;
  mt: number;
  mb: number;
  padR: number;
  dot: number; // radius of a full-size note
  nest: number; // how much each stacked chord layer shrinks
  scaleDot: number;
  ring: number; // selection / preview ring
  markRing: number;
  hit: number;
  label: number; // font sizes
  labelWeight: number;
  stringSize: number;
  stringWeight: number;
  numSize: number;
}

const THEMED: Look = {
  ml: 36, openW: 44, fretW: 56, strH: 48, mt: 24, mb: 36, padR: 16,
  dot: 13, nest: 4, scaleDot: 10, ring: 17, markRing: 18, hit: 20,
  label: 11, labelWeight: 800, stringSize: 13, stringWeight: 600, numSize: 12,
};

const PLAIN: Look = {
  ml: 34, openW: 64, fretW: 64, strH: 26, mt: 16, mb: 34, padR: 8,
  dot: 11, nest: 3.5, scaleDot: 11, ring: 14, markRing: 15, hit: 13,
  label: 10, labelWeight: 700, stringSize: 11, stringWeight: 400, numSize: 11,
};

export const FRETBOARD_FONT = "'Segoe UI', Roboto, system-ui, -apple-system, sans-serif";

@Component({
  selector: 'soloin-fretboard',
  templateUrl: './soloin-fretboard.html',
  host: { '[class.plain]': 'plain()' },
  styleUrl: './soloin-fretboard.scss',
})
export class SoloinFretboard {
  readonly scaleNotes = input.required<Note[]>();
  readonly scaleLabels = input<string[]>([]); // parallel to scaleNotes
  readonly scaleRoot = input<Note | null>(null);
  // Parallel to scaleNotes: 0 rest .. 3 tense (see tension.ts). Null = one colour for the whole scale.
  readonly scaleLevels = input<readonly number[] | null>(null);
  readonly chordLayers = input<ChordLayer[]>([]);
  // Empty = no CAGED filtering (show everything); one or more ranges = only
  // positions inside at least one of them stay visible — lets the caller
  // overlay several boxes at once (e.g. practicing a shift from C to A).
  readonly cagedBoxes = input<FretRange[]>([]);
  // Draw only the frets the CAGED boxes cover (growing as boxes are added)
  // instead of the whole neck, so the eye stays on the part being used.
  readonly cropToBoxes = input(false);
  // Tint the frets each box covers and name it, as the riff card does. Boxes
  // overlap, so this is the only way to tell which ones are on.
  readonly boxBands = input(false);
  readonly tuning = input<Tuning>(TUNINGS[0]);
  readonly ariaLabel = input('Fretboard');
  // The riff card's look: white panel, thin grey hardware, ink dots with a red
  // root, every fret numbered. Drawn through attributes (not just CSS) so image
  // export, which serializes the SVG on its own, comes out the same.
  readonly plain = input(false);
  // Shown inside the board's own frame, e.g. the key and scale while the host's controls are folded away.
  readonly caption = input('');

  // Selectable mode: every position is drawn as a dimmed, focusable note; a click
  // (or Enter/Space) toggles that exact position and emits it. The parent owns the
  // selected set (keys from fretPositionKey), so it can persist or analyse it.
  readonly selectable = input(false);
  readonly selectedPositions = input<ReadonlySet<string>>(new Set());
  readonly positionToggled = output<FretPosition>();
  // Selectable mode only: light up the notes of a scale being previewed (every octave),
  // ring its root and fade everything else. Empty = no preview.
  readonly previewNotes = input<Note[]>([]);
  readonly previewRoot = input<Note | null>(null);
  readonly previewActive = computed(() => this.previewNotes().length > 0);

  // User marks. In selectable mode they are the selected positions (above); in the
  // normal read-only view, `markedPositions` draws them on top of the notes. The
  // 'highlight' variant keeps them distinct from the scale dots and the tonic triad
  // (which use the primary colour).
  readonly markedPositions = input<ReadonlySet<string>>(new Set());
  readonly markVariant = input<'primary' | 'highlight'>('primary');
  readonly markColor = computed(() =>
    this.markVariant() === 'highlight' ? 'var(--_chords-chord-color-3)' : 'var(--_chords-chord-color-1)',
  );
  readonly markInk = computed(() =>
    this.markVariant() === 'highlight' ? 'var(--_chords-preview-ink, #0b1020)' : 'var(--_chords-on-primary)',
  );

  readonly marks = computed(() => {
    if (this.selectable()) return [];
    const strings = this.tuning().strings;
    return [...this.markedPositions()].flatMap((key) => {
      const [s, f] = key.split(':').map(Number);
      if (!Number.isInteger(s) || !Number.isInteger(f) || strings[s] === undefined || !this.shows(f)) return [];
      return [{ key, x: this.x(f), y: this.y(s), label: noteName(mod12(strings[s] + f)) }];
    });
  });
  readonly positionAriaLabel = input<(note: string, stringNote: string, fret: number) => string>(
    (note, stringNote, fret) => `${note}, ${stringNote} string, fret ${fret}`,
  );

  readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  readonly fontFamily = FRETBOARD_FONT;
  readonly look = computed(() => (this.plain() ? PLAIN : THEMED));
  // First and last fret drawn. The whole neck unless cropping to the boxes.
  readonly span = computed(() => {
    const boxes = this.cagedBoxes();
    if (!this.cropToBoxes() || boxes.length === 0) return { from: 0, to: FRETS };
    const from = Math.min(FRETS - 1, Math.min(...boxes.map((b) => b.start)));
    return { from, to: Math.min(FRETS, Math.max(...boxes.map((b) => b.end))) };
  });
  private shows(fret: number): boolean {
    return fret >= this.span().from && fret <= this.span().to;
  }
  private x(fret: number): number {
    const g = this.look();
    const { from } = this.span();
    // A window that starts up the neck has no open-string column: every fret is an equal cell.
    if (from > 0) return g.ml + (fret - from + 0.5) * g.fretW;
    return fret === 0 ? g.ml + g.openW / 2 : g.ml + g.openW + (fret - 0.5) * g.fretW;
  }
  private y(stringIndex: number): number {
    const g = this.look();
    return g.mt + stringIndex * g.strH;
  }
  private readonly width = computed(() => {
    const g = this.look();
    const { from, to } = this.span();
    return from > 0 ? g.ml + (to - from + 1) * g.fretW : g.ml + g.openW + to * g.fretW;
  });
  // A cropped board is a handful of frets: let it fill the width like the riff card does.
  readonly cropped = computed(() => this.span().from > 0 || this.span().to < FRETS);
  readonly hasNut = computed(() => this.span().from === 0);

  readonly bands = computed(() => {
    if (!this.boxBands()) return [];
    const g = this.look();
    const { from, to } = this.span();
    const cellW = (f: number) => (f === 0 && from === 0 ? g.openW : g.fretW);
    return [...this.cagedBoxes()]
      .sort((a, b) => a.start - b.start)
      .filter((box) => box.start <= to && box.end >= from)
      .map((box, i) => {
        const first = Math.max(box.start, from);
        const last = Math.min(box.end, to);
        const x = this.x(first) - cellW(first) / 2;
        return {
          x,
          width: this.x(last) + cellW(last) / 2 - x,
          y: g.mt - 10,
          height: this.y(STRING_COUNT - 1) - g.mt + 20,
          labelX: this.x(first) - cellW(first) / 2 + 9,
          shape: box.shape ?? '',
          colorVar: i % 2 ? '--_chords-chord-color-1' : '--_chords-chord-color-2',
        };
      });
  });
  private readonly height = computed(() => this.y(STRING_COUNT - 1) + this.look().mb);
  readonly viewBox = computed(() => `0 0 ${this.width() + this.look().padR} ${this.height()}`);
  // The riff card centres its string names in the margin; the themed board hangs them off the nut.
  readonly stringLabelX = computed(() => (this.plain() ? 14 : this.look().ml - 6));
  readonly stringLineX2 = this.width;
  readonly stringY1 = computed(() => this.look().mt);
  readonly stringY2 = computed(() => this.y(STRING_COUNT - 1));
  readonly fretNumY = computed(() => (this.plain() ? this.stringY2() + 28 : this.height() - 6));
  readonly nutX = computed(() => this.look().ml);

  readonly fretLines = computed(() => {
    const g = this.look();
    const { from, to } = this.span();
    if (from > 0) {
      // Left edge, then the wire closing each fret in the window.
      return Array.from({ length: to - from + 2 }, (_, i) => ({ x: g.ml + i * g.fretW, isNut: i === 0 && this.plain() }));
    }
    const wires = Array.from({ length: to + 1 }, (_, i) => ({
      x: g.ml + g.openW + i * g.fretW,
      // Plain: the board's left edge is the bold line, every wire after it is equal.
      isNut: i === 0 && !this.plain(),
    }));
    return this.plain() ? [{ x: g.ml, isNut: true }, ...wires] : wires;
  });
  readonly fretNumbers = computed(() =>
    Array.from({ length: FRETS + 1 }, (_, f) => ({ x: this.x(f), label: f })).filter(
      // A cropped window numbers every fret: with so few, the usual 3-5-7-9 hints may all fall outside it.
      (n) => this.shows(n.label) && (this.plain() || this.cropped() || [0, 3, 5, 7, 9, 12].includes(n.label)),
    ),
  );
  readonly positionMarkers = computed(() => {
    const g = this.look();
    const centerY = g.mt + ((STRING_COUNT - 1) / 2) * g.strH;
    return [
      ...[3, 5, 7, 9].map((f) => ({ f, cx: this.x(f), cy: centerY })),
      { f: 12, cx: this.x(12), cy: centerY - g.strH / 2 },
      { f: 12, cx: this.x(12), cy: centerY + g.strH / 2 },
    ].filter((m) => this.shows(m.f));
  });

  readonly strings = computed(() =>
    this.tuning().strings.map((openPc, si) => ({
      // Tab convention on the plain board: the thinnest string in lower case.
      label: this.plain() && si === 0 ? noteName(openPc).toLowerCase() : noteName(openPc),
      y: this.y(si),
    })),
  );

  readonly selectableDots = computed((): SelectableDot[] => {
    if (!this.selectable()) return [];
    const selected = this.selectedPositions();
    const previewSet = new Set(this.previewNotes());
    const previewRoot = this.previewRoot();
    const { from, to } = this.span();
    return this.tuning().strings.flatMap((openPc, si) =>
      Array.from({ length: to - from + 1 }, (_, i) => {
        const f = from + i;
        const pc = mod12(openPc + f);
        const key = fretPositionKey(si, f);
        const label = noteName(pc);
        return {
          key,
          position: { string: si, fret: f, pc },
          x: this.x(f),
          y: this.y(si),
          label,
          selected: selected.has(key),
          inPreview: previewSet.has(pc),
          isPreviewRoot: previewRoot !== null && pc === previewRoot,
          ariaLabel: this.positionAriaLabel()(label, noteName(openPc), f),
        };
      }),
    );
  });

  togglePosition(position: FretPosition): void {
    this.positionToggled.emit(position);
  }

  // ponytail: readability degrades past ~3 overlapping chord layers at one
  // fret/string (rings nest inward); fine for typical 3-4 chord progressions.
  // Upgrade path: fan the dots out instead of nesting them if that ever bites.
  readonly dots = computed((): RenderDot[] => {
    const scaleNotesArr = this.scaleNotes();
    const scaleLabelsArr = this.scaleLabels();
    const scaleRootPc = this.scaleRoot();
    const scaleLabelByPc = new Map<Note, string>();
    scaleNotesArr.forEach((n, i) => scaleLabelByPc.set(n, scaleLabelsArr[i] ?? ''));
    const levels = this.scaleLevels();
    const plain = this.plain();
    const g = this.look();
    const scaleColor = (pc: Note) =>
      levels
        ? `--_chords-tension-${levels[scaleNotesArr.indexOf(pc)] ?? 2}`
        : plain && pc === scaleRootPc
          ? '--_chords-scale-root'
          : '--_chords-scale-note';

    const layers = this.chordLayers();
    const boxes = this.cagedBoxes();
    const openPitches = this.tuning().strings;
    const out: RenderDot[] = [];

    openPitches.forEach((openPc, si) => {
      for (let f = this.span().from; f <= this.span().to; f++) {
        if (boxes.length > 0 && !boxes.some((box) => f >= box.start && f <= box.end)) continue;
        const pc = mod12(openPc + f);
        const x = this.x(f);
        const y = this.y(si);

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
              r: g.dot - i * g.nest,
              ring: pc === m.layer.root ? g.dot - i * g.nest + 3 : null,
              colorVar: m.layer.colorVar,
              label: i === 0 ? m.label : '',
              isRoot: pc === m.layer.root,
            });
          });
        } else if (scaleLabelByPc.has(pc)) {
          const isRoot = pc === scaleRootPc;
          // Plain: a red root needs no ring; by tension it gets the riff card's halo instead.
          const ring = !isRoot ? null : !plain ? g.scaleDot + 3 : levels ? 15 : null;
          out.push({ x, y, r: g.scaleDot, ring, colorVar: scaleColor(pc), label: scaleLabelByPc.get(pc)!, isRoot });
        }
      }
    });

    return out;
  });
}
