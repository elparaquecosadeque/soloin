import { Component, computed, input, signal, viewChildren } from '@angular/core';
import {
  buildChordTones,
  buildScale,
  detectKey,
  type Key,
  type Note,
  noteName,
  type ParsedChord,
  parseChordName,
  type ScaleName,
} from './engine';
import { SoloinFretboard, type ChordLayer } from './components/soloin-fretboard/soloin-fretboard';

export type Language = 'en' | 'es';

type InputMode = 'progression' | 'key';

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
  legendLabel: string;
  mosaicView: string;
  carouselView: string;
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
    legendLabel: 'Chord tones',
    mosaicView: 'Mosaic',
    carouselView: 'Carousel',
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
    legendLabel: 'Notas de los acordes',
    mosaicView: 'Mosaico',
    carouselView: 'Carrusel',
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

  readonly activeKey = computed<Key | null>(() =>
    this.mode() === 'progression' ? detectKey(this.chordTokens()) : this.selectedKey(),
  );

  readonly effectiveScale = computed<ScaleName>(
    () => this.scaleOverride() ?? (this.activeKey()?.mode === 'minor' ? 'aeolian' : 'ionian'),
  );

  readonly scaleNotes = computed<Note[]>(() => {
    const key = this.activeKey();
    return key ? buildScale(key.root, this.effectiveScale()) : [];
  });

  readonly chordLayers = computed<ChordLayer[]>(() => {
    if (this.mode() !== 'progression') return [];
    const slots = new Map<Note, number>();
    return this.parsedChords().map((chord) => {
      if (!slots.has(chord.root)) slots.set(chord.root, slots.size);
      const slot = slots.get(chord.root)! % 6;
      return {
        label: chord.raw,
        tones: buildChordTones(chord.root, chord.quality),
        colorVar: `--_chords-chord-color-${slot + 1}`,
      };
    });
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
    const lines = [`${keyPart} — ${t.scaleNames[this.effectiveScale()]}: ${this.scaleNotes().map((n) => noteName(n)).join(', ')}`];
    for (const layer of this.chordLayers()) {
      lines.push(`${layer.label}: ${layer.tones.map((n) => noteName(n)).join(', ')}`);
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
