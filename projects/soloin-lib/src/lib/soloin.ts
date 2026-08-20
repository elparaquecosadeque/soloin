import { Component, computed, input, signal, viewChildren } from '@angular/core';
import {
  buildChordTones,
  buildScale,
  CHORD_DEGREE_LABELS,
  type ChordQuality,
  detectKey,
  type Key,
  type Note,
  noteName,
  type ParsedChord,
  parseChordName,
  SCALE_DEGREE_LABELS,
  suggestChordName,
  type ScaleName,
} from './engine';
import { SoloinFretboard, type ChordLayer } from './components/soloin-fretboard/soloin-fretboard';
import { CAGED_SHAPES, type CagedShape, cagedBoxRange, type FretRange } from './components/soloin-fretboard/caged';

export type Language = 'en' | 'es';

type InputMode = 'progression' | 'key';
type LabelMode = 'notes' | 'degrees';
type HighlightMode = 'all' | 'caged';

interface CopyText {
  title: string;
  subtitle: string;
  progressionModeLabel: string;
  keyModeLabel: string;
  progressionLabel: string;
  placeholder: string;
  keyLabel: string;
  scaleLabel: string;
  scaleNames: Record<ScaleName, string>;
  major: string;
  minor: string;
  detectedKey: (keyLabel: string) => string;
  noKeyDetected: string;
  unrecognizedChord: (raw: string, suggestion: string | null) => string;
  legendLabel: string;
  mosaicView: string;
  carouselView: string;
  showScaleNotes: string;
  notesLabelMode: string;
  degreesLabelMode: string;
  highlightLabel: string;
  highlightAll: string;
  highlightCaged: string;
  boxLabel: string;
  previous: string;
  next: string;
  chordOf: (index: number, total: number) => string;
  exportPng: string;
  exportPdf: string;
  exportUnavailable: string;
  copyText: string;
  copied: string;
}

const SCALE_ORDER: ScaleName[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
];

const ALL_KEYS: Key[] = Array.from({ length: 24 }, (_, i) => ({
  root: Math.floor(i / 2),
  mode: i % 2 === 0 ? 'major' : 'minor',
}));

const COPY: Record<Language, CopyText> = {
  en: {
    title: 'Soloin',
    subtitle: 'Find the scales that fit your progression and see exactly which notes to target.',
    progressionModeLabel: 'Progression',
    keyModeLabel: 'Key',
    progressionLabel: 'Chord progression',
    placeholder: 'e.g. Am, F, C, G',
    keyLabel: 'Key',
    scaleLabel: 'Scale',
    scaleNames: {
      ionian: 'Ionian (Major)',
      dorian: 'Dorian',
      phrygian: 'Phrygian',
      lydian: 'Lydian',
      mixolydian: 'Mixolydian',
      aeolian: 'Aeolian (Minor)',
      locrian: 'Locrian',
      majorPentatonic: 'Major Pentatonic',
      minorPentatonic: 'Minor Pentatonic',
      blues: 'Blues',
    },
    major: 'major',
    minor: 'minor',
    detectedKey: (keyLabel) => `Detected key: ${keyLabel}`,
    noKeyDetected: 'No key detected yet — enter at least one recognizable chord.',
    unrecognizedChord: (raw, suggestion) =>
      suggestion ? `"${raw}" not recognized — did you mean "${suggestion}"?` : `"${raw}" not recognized`,
    legendLabel: 'Chord tones',
    mosaicView: 'Mosaic',
    carouselView: 'Carousel',
    showScaleNotes: 'Show key notes',
    notesLabelMode: 'Notes',
    degreesLabelMode: 'Degrees',
    highlightLabel: 'Highlight',
    highlightAll: 'All',
    highlightCaged: 'CAGED',
    boxLabel: 'Box',
    previous: 'Previous',
    next: 'Next',
    chordOf: (index, total) => `Chord ${index} of ${total}`,
    exportPng: 'Export PNG',
    exportPdf: 'Export PDF',
    exportUnavailable: 'Switch to Carousel to export an image',
    copyText: 'Copy as text',
    copied: 'Copied!',
  },
  es: {
    title: 'Soloin',
    subtitle: 'Encuentra las escalas que encajan con tu progresión y ve exactamente qué notas tocar.',
    progressionModeLabel: 'Progresión',
    keyModeLabel: 'Tonalidad',
    progressionLabel: 'Progresión de acordes',
    placeholder: 'ej. Am, F, C, G',
    keyLabel: 'Tonalidad',
    scaleLabel: 'Escala',
    scaleNames: {
      ionian: 'Jónico (Mayor)',
      dorian: 'Dórico',
      phrygian: 'Frigio',
      lydian: 'Lidio',
      mixolydian: 'Mixolidio',
      aeolian: 'Eólico (Menor)',
      locrian: 'Locrio',
      majorPentatonic: 'Pentatónica mayor',
      minorPentatonic: 'Pentatónica menor',
      blues: 'Blues',
    },
    major: 'mayor',
    minor: 'menor',
    detectedKey: (keyLabel) => `Tonalidad detectada: ${keyLabel}`,
    noKeyDetected: 'Aún no se detecta ninguna tonalidad — introduce al menos un acorde reconocible.',
    unrecognizedChord: (raw, suggestion) =>
      suggestion ? `"${raw}" no reconocido — ¿quisiste decir "${suggestion}"?` : `"${raw}" no reconocido`,
    legendLabel: 'Notas de los acordes',
    mosaicView: 'Mosaico',
    carouselView: 'Carrusel',
    showScaleNotes: 'Mostrar notas de la tonalidad',
    notesLabelMode: 'Notas',
    degreesLabelMode: 'Grados',
    highlightLabel: 'Resaltado',
    highlightAll: 'Todo',
    highlightCaged: 'CAGED',
    boxLabel: 'Caja',
    previous: 'Anterior',
    next: 'Siguiente',
    chordOf: (index, total) => `Acorde ${index} de ${total}`,
    exportPng: 'Exportar PNG',
    exportPdf: 'Exportar PDF',
    exportUnavailable: 'Cambia a Carrusel para exportar una imagen',
    copyText: 'Copiar como texto',
    copied: '¡Copiado!',
  },
};

@Component({
  selector: 'the-chords-soloin',
  imports: [SoloinFretboard],
  templateUrl: './soloin.html',
  styleUrl: './soloin.scss',
  host: { '[attr.lang]': 'language()' },
})
export class SoloinComponent {
  readonly language = input<Language>('en');
  readonly text = computed(() => COPY[this.language()]);

  readonly scaleOrder = SCALE_ORDER;
  readonly allKeys = ALL_KEYS;

  readonly mode = signal<InputMode>('progression');
  readonly progressionInput = signal('Am, F, C, G');
  readonly selectedKey = signal<Key>({ root: 0, mode: 'major' });
  readonly scaleOverride = signal<ScaleName | null>(null);
  readonly copied = signal(false);

  readonly chordView = signal<'mosaic' | 'carousel'>('mosaic');
  readonly carouselIndex = signal(0);
  // Off by default: a chord's own tones are what "belongs" to it. The scale
  // backdrop is the surrounding progression's overall key, shared across every
  // chord tile — showing it by default made it look like part of the chord
  // itself (see HANDOFF.md gotchas), so it's opt-in instead.
  readonly showScaleNotes = signal(false);
  readonly labelMode = signal<LabelMode>('notes');
  readonly highlightMode = signal<HighlightMode>('all');
  readonly cagedShape = signal<CagedShape>('C');
  readonly cagedShapes = CAGED_SHAPES;

  // viewChildren, not viewChild: mosaic view renders one <soloin-fretboard>
  // per chord. Export always targets the first rendered board, which is the
  // only one in key mode and in carousel mode (mosaic disables export instead
  // of guessing which of several boards the user meant — see canExportImage).
  private readonly fretboards = viewChildren(SoloinFretboard);

  private readonly chordTokens = computed(() =>
    this.progressionInput()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  readonly parsedChords = computed<ParsedChord[]>(() =>
    this.chordTokens()
      .map(parseChordName)
      .filter((c): c is ParsedChord => c !== null),
  );

  // Chords that failed to parse are otherwise silently dropped from
  // chordLayers with no trace — surface them instead of letting a mistyped
  // chord just vanish from the progression without explanation.
  readonly unparsedChords = computed<{ raw: string; suggestion: string | null }[]>(() =>
    this.chordTokens()
      .filter((t) => parseChordName(t) === null)
      .map((raw) => ({ raw, suggestion: suggestChordName(raw) })),
  );

  readonly activeKey = computed<Key | null>(() =>
    this.mode() === 'progression' ? detectKey(this.chordTokens()) : this.selectedKey(),
  );

  readonly effectiveScale = computed<ScaleName>(
    () => this.scaleOverride() ?? (this.activeKey()?.mode === 'minor' ? 'aeolian' : 'ionian'),
  );

  // CAGED boxes are picked per key/progression, not per chord — you stay in
  // one hand position for the whole progression rather than hopping shapes
  // chord to chord, so this applies uniformly to every rendered fretboard.
  readonly cagedBox = computed<FretRange | null>(() => {
    if (this.highlightMode() !== 'caged') return null;
    const key = this.activeKey();
    return key ? cagedBoxRange(this.cagedShape(), key.root) : null;
  });

  readonly scaleNotes = computed<Note[]>(() => {
    const key = this.activeKey();
    return key ? buildScale(key.root, this.effectiveScale()) : [];
  });

  readonly scaleLabels = computed<string[]>(() => {
    if (this.labelMode() === 'degrees') return [...SCALE_DEGREE_LABELS[this.effectiveScale()]];
    return this.scaleNotes().map((n) => noteName(n));
  });

  private toneLabelsFor(tones: Note[], quality: ChordQuality): string[] {
    if (this.labelMode() === 'degrees') return [...CHORD_DEGREE_LABELS[quality]];
    return tones.map((n) => noteName(n));
  }

  readonly chordLayers = computed<ChordLayer[]>(() => {
    if (this.mode() !== 'progression') return [];
    const slots = new Map<Note, number>();
    return this.parsedChords().map((chord) => {
      if (!slots.has(chord.root)) slots.set(chord.root, slots.size);
      const slot = slots.get(chord.root)! % 6;
      const tones = buildChordTones(chord.root, chord.quality);
      return {
        label: chord.raw,
        root: chord.root,
        tones,
        toneLabels: this.toneLabelsFor(tones, chord.quality),
        colorVar: `--_chords-chord-color-${slot + 1}`,
      };
    });
  });

  // In Key mode, the tonic triad (I major or i minor) is highlighted within
  // the full scale as a harmonic anchor — the specific mode/scale picked in
  // the dropdown (e.g. Locrian) doesn't change this; it's always a plain
  // major/minor triad off the key's own mode, kept simple on purpose.
  readonly keyTonicLayer = computed<ChordLayer | null>(() => {
    if (this.mode() !== 'key') return null;
    const key = this.activeKey();
    if (!key) return null;
    const quality: ChordQuality = key.mode === 'major' ? 'major' : 'minor';
    const tones = buildChordTones(key.root, quality);
    return {
      label: this.keyLabel(key),
      root: key.root,
      tones,
      toneLabels: this.toneLabelsFor(tones, quality),
      colorVar: '--_chords-chord-color-1',
    };
  });

  readonly detectedKeyLabel = computed(() => {
    const key = this.activeKey();
    return key ? this.keyLabel(key) : null;
  });

  readonly activeChordLayer = computed<ChordLayer | null>(() => {
    const layers = this.chordLayers();
    if (layers.length === 0) return null;
    return layers[Math.min(this.carouselIndex(), layers.length - 1)];
  });

  // Image export needs exactly one unambiguous fretboard on screen: always
  // true in key mode (single overview board) and in progression mode once
  // either there are no chords yet or the carousel view is showing just one.
  readonly canExportImage = computed(
    () => this.mode() !== 'progression' || this.chordView() === 'carousel' || this.chordLayers().length === 0,
  );

  keyLabel(key: Key): string {
    const t = this.text();
    return `${noteName(key.root)} ${key.mode === 'major' ? t.major : t.minor}`;
  }

  setMode(mode: InputMode): void {
    this.mode.set(mode);
  }

  setChordView(view: 'mosaic' | 'carousel'): void {
    this.chordView.set(view);
  }

  setLabelMode(mode: LabelMode): void {
    this.labelMode.set(mode);
  }

  setHighlightMode(mode: HighlightMode): void {
    this.highlightMode.set(mode);
  }

  setCagedShape(shape: CagedShape): void {
    this.cagedShape.set(shape);
  }

  toggleScaleNotes(event: Event): void {
    this.showScaleNotes.set((event.target as HTMLInputElement).checked);
  }

  stepCarousel(delta: number): void {
    const max = this.chordLayers().length - 1;
    this.carouselIndex.update((i) => Math.max(0, Math.min(max, i + delta)));
  }

  onProgressionInput(event: Event): void {
    this.progressionInput.set((event.target as HTMLInputElement).value);
  }

  onKeyChange(event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    this.selectedKey.set(this.allKeys[index]);
  }

  onScaleChange(event: Event): void {
    this.scaleOverride.set((event.target as HTMLSelectElement).value as ScaleName);
  }

  summaryText(): string {
    const t = this.text();
    const key = this.activeKey();
    const keyPart = key ? this.keyLabel(key) : '?';
    const lines = [`${keyPart} — ${t.scaleNames[this.effectiveScale()]}: ${this.scaleLabels().join(', ')}`];
    const tonic = this.keyTonicLayer();
    if (tonic) lines.push(`${tonic.label} (I): ${tonic.toneLabels.join(', ')}`);
    for (const layer of this.chordLayers()) {
      lines.push(`${layer.label}: ${layer.toneLabels.join(', ')}`);
    }
    return lines.join('\n');
  }

  copyAsText(): void {
    navigator.clipboard.writeText(this.summaryText());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  private exportTitle(): string {
    const t = this.text();
    const key = this.activeKey();
    const keyPart = key ? this.keyLabel(key) : '?';
    const scalePart = t.scaleNames[this.effectiveScale()];
    const chord = this.chordView() === 'carousel' ? this.activeChordLayer() : null;
    return chord ? `${t.title} — ${chord.label} — ${keyPart} · ${scalePart}` : `${t.title} — ${keyPart} · ${scalePart}`;
  }

  async exportPng(): Promise<void> {
    if (!this.canExportImage()) return;
    const svgEl = this.fretboards()[0]?.svgRef().nativeElement;
    if (!svgEl) return;
    const { downloadPng } = await import('./export/rasterize');
    await downloadPng(svgEl, 'soloin.png', this.exportTitle());
  }

  async exportPdf(): Promise<void> {
    if (!this.canExportImage()) return;
    const svgEl = this.fretboards()[0]?.svgRef().nativeElement;
    if (!svgEl) return;
    const { openPdfPreview } = await import('./export/rasterize');
    await openPdfPreview(svgEl, this.exportTitle());
  }
}
