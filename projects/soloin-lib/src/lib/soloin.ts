import { Component, computed, HostListener, input, signal, viewChildren } from '@angular/core';
import {
  buildChordTones,
  buildScale,
  CHORD_DEGREE_LABELS,
  type ChordQuality,
  isDiatonic,
  type Key,
  type Note,
  mod12,
  noteName,
  type ParsedChord,
  parseChordName,
  SCALE_DEGREE_LABELS,
  suggestChordName,
  type ScaleName,
} from '@gblp/music-theory';
import {
  fretPositionKey,
  type FretPosition,
  SoloinFretboard,
  type ChordLayer,
} from './components/soloin-fretboard/soloin-fretboard';
import { CAGED_SHAPES, type CagedShape, cagedBoxRange, type FretRange } from './components/soloin-fretboard/caged';
import { findTuning, TUNINGS, type Tuning, type TuningName } from './components/soloin-fretboard/tunings';
import { IDENTIFY_MIN_NOTES, identifyScales, type IdentifyGroup, type IdentifyMatch } from './identify';
import { marksToNumbers, numbersToMarks, type SoloinSessionState } from './session-state';

export type { SoloinSessionState } from './session-state';

const NO_MARKS: ReadonlySet<string> = new Set();

export type Language = 'en' | 'es';

// A degree label already carries its own accidental (e.g. Phrygian's "b2", Lydian's
// "#4") — spelling straight off it beats music-theory's fixed always-sharp default
// and matches how every scale reference (muted.io included) spells modal alterations,
// with no per-root key-signature table needed.
function spellNote(pc: Note, degreeLabel: string): string {
  return noteName(pc, degreeLabel.startsWith('b'));
}

interface KeyCandidate {
  key: Key;
  score: number;
}

// ponytail: reimplements music-theory's detectKey scoring loop locally (via the
// already-exported isDiatonic) instead of a new music-theory export, so this ships
// without a cross-repo npm publish. Upgrade path: hoist into music-theory as
// detectKeyCandidates() once both packages are due for a version bump anyway.
function detectKeyCandidates(chordNames: string[]): KeyCandidate[] {
  const parsed = chordNames.map(parseChordName).filter((c): c is ParsedChord => c !== null);
  if (parsed.length === 0) return [];

  const candidates: KeyCandidate[] = [];
  for (let root = 0; root < 12; root++) {
    for (const mode of ['major', 'minor'] as const) {
      const key: Key = { root, mode };
      const score = parsed.filter((c) => isDiatonic(c, key)).length;
      if (score > 0) candidates.push({ key, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

type InputMode = 'progression' | 'key' | 'identify';
type LabelMode = 'notes' | 'degrees';
type HighlightMode = 'all' | 'caged';

interface CopyText {
  title: string;
  subtitle: string;
  progressionModeLabel: string;
  keyModeLabel: string;
  identifyModeLabel: string;
  identifyClear: string;
  identifyNeedMore: (count: number, min: number) => string;
  identifySelected: (notes: string) => string;
  identifyNoMatch: string;
  identifyChordsLabel: string;
  identifyChordsPlaceholder: string;
  identifySuggestedHint: string;
  identifyTouchHint: string;
  markToggle: string;
  markClear: string;
  markHintEditing: (count: number) => string;
  markCount: (count: number) => string;
  markedNotesLine: (names: string) => string;
  identifyFretboardLabel: string;
  identifyPositionLabel: (note: string, stringNote: string, fret: number) => string;
  identifyNoteCount: (count: number) => string;
  identifyApply: string;
  identifyResultsLabel: string;
  progressionLabel: string;
  placeholder: string;
  keyLabel: string;
  scaleLabel: string;
  scaleNames: Record<ScaleName, string>;
  major: string;
  minor: string;
  detectedKey: (keyLabel: string) => string;
  noKeyDetected: string;
  alsoFitsLabel: string;
  unrecognizedChord: (raw: string, suggestion: string | null) => string;
  nonDiatonicBadge: string;
  legendLabel: string;
  mosaicView: string;
  carouselView: string;
  showScaleNotes: string;
  showKeyMarks: string;
  notesLabelMode: string;
  degreesLabelMode: string;
  highlightLabel: string;
  highlightAll: string;
  highlightCaged: string;
  boxLabel: string;
  tuningLabel: string;
  tuningNames: Record<TuningName, string>;
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

// Scales that, when found in a group, name the group (the relative keys for a 7-note
// set, otherwise the pentatonic/blues pair) — the rest are shown as its modes.
const IDENTIFY_HEADLINE_SCALES: ScaleName[] = ['ionian', 'aeolian', 'majorPentatonic', 'minorPentatonic', 'blues'];

// A scale's own root is what drives the highlighted notes (see scaleNotes), so the
// Key select only needs a major/minor flavour close to the scale's character.
const MINOR_FLAVOURED_SCALES = new Set<ScaleName>(['dorian', 'phrygian', 'aeolian', 'locrian', 'minorPentatonic', 'blues']);

export interface IdentifyGroupView {
  id: string;
  headline: string;
  noteCount: string;
  noteNames: string;
  chips: { match: IdentifyMatch; label: string; suggested: boolean }[];
}

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
    identifyModeLabel: 'Identify',
    identifyClear: 'Clear',
    identifyNeedMore: (count, min) =>
      `Mark at least ${min} different notes on the fretboard, or add chords (${count}/${min}).`,
    identifySelected: (notes) => `Notes considered: ${notes}`,
    identifyNoMatch: 'No scale contains all the marked notes and chord tones. Try removing a note or a chord.',
    identifyChordsLabel: 'Chords you solo over (optional)',
    identifyChordsPlaceholder: 'e.g. Cm, Fm, G7 — some or all',
    identifySuggestedHint: 'Rooted on your first chord',
    identifyTouchHint: 'Tap once to preview on the fretboard, tap again to apply.',
    markToggle: 'Mark notes',
    markClear: 'Clear marks',
    markHintEditing: (count) => `Click positions to mark them (${count} marked). Turn off to see them on the fretboard.`,
    markCount: (count) => `${count} marked`,
    markedNotesLine: (names) => `Marked notes: ${names}`,
    identifyFretboardLabel: 'Fretboard — mark the notes you hear',
    identifyPositionLabel: (note, stringNote, fret) => `${note}, ${stringNote} string, fret ${fret}`,
    identifyNoteCount: (count) => `${count} notes`,
    identifyApply: 'Show in Key mode',
    identifyResultsLabel: 'Scales that fit',
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
    alsoFitsLabel: 'Also fits:',
    unrecognizedChord: (raw, suggestion) =>
      suggestion ? `"${raw}" not recognized — did you mean "${suggestion}"?` : `"${raw}" not recognized`,
    nonDiatonicBadge: 'non-diatonic',
    legendLabel: 'Chord tones',
    mosaicView: 'Mosaic',
    carouselView: 'Carousel',
    showScaleNotes: 'Show key notes',
    showKeyMarks: 'Show my marks',
    notesLabelMode: 'Notes',
    degreesLabelMode: 'Degrees',
    highlightLabel: 'Highlight',
    highlightAll: 'All',
    highlightCaged: 'CAGED',
    boxLabel: 'Box',
    tuningLabel: 'Tuning',
    tuningNames: {
      standard: 'Standard',
      dropD: 'Drop D',
      dadgad: 'DADGAD',
      openG: 'Open G',
      openD: 'Open D',
    },
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
    identifyModeLabel: 'Identificar',
    identifyClear: 'Limpiar',
    identifyNeedMore: (count, min) =>
      `Marca al menos ${min} notas distintas en el diapasón, o agrega acordes (${count}/${min}).`,
    identifySelected: (notes) => `Notas consideradas: ${notes}`,
    identifyNoMatch: 'Ninguna escala contiene todas las notas marcadas y las notas de los acordes. Prueba quitando una nota o un acorde.',
    identifyChordsLabel: 'Acordes sobre los que improvisas (opcional)',
    identifyChordsPlaceholder: 'ej. Cm, Fm, G7 — algunos o todos',
    identifySuggestedHint: 'Con raíz en tu primer acorde',
    identifyTouchHint: 'Toca una vez para previsualizar en el diapasón, otra vez para aplicar.',
    markToggle: 'Marcar notas',
    markClear: 'Limpiar marcas',
    markHintEditing: (count) => `Toca posiciones para marcarlas (${count} marcadas). Apágalo para verlas en el diapasón.`,
    markCount: (count) => `${count} marcadas`,
    markedNotesLine: (names) => `Notas marcadas: ${names}`,
    identifyFretboardLabel: 'Diapasón — marca las notas que escuchas',
    identifyPositionLabel: (note, stringNote, fret) => `${note}, cuerda ${stringNote}, traste ${fret}`,
    identifyNoteCount: (count) => `${count} notas`,
    identifyApply: 'Ver en modo Tonalidad',
    identifyResultsLabel: 'Escalas que encajan',
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
    alsoFitsLabel: 'También encajan:',
    unrecognizedChord: (raw, suggestion) =>
      suggestion ? `"${raw}" no reconocido — ¿quisiste decir "${suggestion}"?` : `"${raw}" no reconocido`,
    nonDiatonicBadge: 'no diatónico',
    legendLabel: 'Notas de los acordes',
    mosaicView: 'Mosaico',
    carouselView: 'Carrusel',
    showScaleNotes: 'Mostrar notas de la tonalidad',
    showKeyMarks: 'Mostrar mis marcas',
    notesLabelMode: 'Notas',
    degreesLabelMode: 'Grados',
    highlightLabel: 'Resaltado',
    highlightAll: 'Todo',
    highlightCaged: 'CAGED',
    boxLabel: 'Caja',
    tuningLabel: 'Afinación',
    tuningNames: {
      standard: 'Estándar',
      dropD: 'Drop D',
      dadgad: 'DADGAD',
      openG: 'Sol abierto',
      openD: 'Re abierto',
    },
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
  // Set only by clicking a tied alternative below the auto-detected key (see
  // tiedKeyAlternatives) — reset whenever the progression text itself changes,
  // since a stale override from a different progression would be meaningless.
  readonly keyOverride = signal<Key | null>(null);
  readonly scaleOverride = signal<ScaleName | null>(null);
  readonly copied = signal(false);

  // Key mode: positions the user marked as relevant to their song, kept until cleared
  // — across key, scale, tuning and mode changes — and saved with the host's session.
  // Separate from identifyMarks, which is scratch work for Identify.
  readonly keyMarks = signal<ReadonlySet<string>>(new Set());
  readonly keyMarkMode = signal(false);
  readonly keyEditing = computed(() => this.mode() === 'key' && this.keyMarkMode());
  // What the read-only Key fretboard draws (empty while editing: the editor shows them itself).
  readonly keyMarksForBoard = computed(() => (this.mode() === 'key' && !this.keyMarkMode() ? this.keyMarks() : NO_MARKS));

  // Identify mode: the exact fret positions the user marked (keys from
  // fretPositionKey). Kept here, not in the fretboard, so it survives leaving the
  // tab and can be read by whatever wants to persist it later.
  readonly identifyMarks = signal<ReadonlySet<string>>(new Set());
  // Optional extra evidence: the chords the solo is played over. Every tone of every
  // chord written here must fit a candidate scale, on top of the marked notes.
  readonly identifyChordsInput = signal('');
  // The result chip being previewed on the fretboard (hover / focus, or pinned by a
  // first touch). Always cleared whenever the results it came from can change.
  readonly identifyPreview = signal<IdentifyMatch | null>(null);
  readonly identifyPreviewNotes = computed<Note[]>(() => {
    const preview = this.identifyPreview();
    return preview ? buildScale(preview.root, preview.scale) : [];
  });
  readonly identifyPreviewRoot = computed<Note | null>(() => this.identifyPreview()?.root ?? null);
  // Recorded on pointerdown: a touch lands as pointerdown -> focus -> click, and focus
  // already sets the preview, so "was it previewed BEFORE this tap?" must be captured first.
  private chipPointer: { type: string; wasPreviewed: boolean } | null = null;

  readonly chordView = signal<'mosaic' | 'carousel'>('mosaic');
  readonly carouselIndex = signal(0);
  // Off by default: a chord's own tones are what "belongs" to it. The scale
  // backdrop is the surrounding progression's overall key, shared across every
  // chord tile — showing it by default made it look like part of the chord
  // itself (see HANDOFF.md gotchas), so it's opt-in instead.
  readonly showScaleNotes = signal(false);
  // Off by default, same reasoning as showScaleNotes: the marks made in Key mode are
  // song-wide, not specific to any one chord, so overlaying them on every tile by
  // default would read as if they belonged to that chord. Read-only here — Progression
  // never edits keyMarks, only Key mode's mark-toggle does.
  readonly showKeyMarksInProgression = signal(false);
  readonly labelMode = signal<LabelMode>('notes');
  readonly highlightMode = signal<HighlightMode>('all');
  readonly cagedShape = signal<CagedShape>('C');
  readonly cagedShapes = CAGED_SHAPES;

  readonly tuningName = signal<TuningName>('standard');
  readonly tunings = TUNINGS;
  readonly tuning = computed<Tuning>(() => findTuning(this.tuningName()));
  // CAGED boxes are anchored to standard-tuning open-chord positions (see
  // caged.ts) — meaningless in any other tuning, so the option is hidden
  // rather than shown computing a box that doesn't correspond to real shapes.
  readonly isStandardTuning = computed(() => this.tuningName() === 'standard');

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

  readonly keyCandidates = computed<KeyCandidate[]>(() =>
    this.mode() === 'progression' ? detectKeyCandidates(this.chordTokens()) : [],
  );

  readonly detectedKey = computed<Key | null>(() => this.keyCandidates()[0]?.key ?? null);

  // Only populated when 2+ keys tie for the top score — e.g. a bare "A" chord
  // fits C# minor, A major, D major, E major and F# minor equally well, so
  // detectKey's pick among them is arbitrary. Surfacing the tie lets the user
  // override it instead of silently trusting whichever one detectKey happened
  // to land on first.
  readonly tiedKeyAlternatives = computed<Key[]>(() => {
    const candidates = this.keyCandidates();
    if (candidates.length < 2 || candidates[1].score < candidates[0].score) return [];
    const topScore = candidates[0].score;
    return candidates.filter((c) => c.score === topScore).map((c) => c.key);
  });

  readonly activeKey = computed<Key | null>(() =>
    this.mode() === 'progression' ? (this.keyOverride() ?? this.detectedKey()) : this.selectedKey(),
  );

  readonly selectedKeyIndex = computed(() =>
    this.allKeys.findIndex((k) => k.root === this.selectedKey().root && k.mode === this.selectedKey().mode),
  );

  // Marked positions -> pitch classes, through the CURRENT tuning, so switching
  // tuning re-reads every mark as the note it now sits on.
  readonly identifyNotes = computed<Note[]>(() => {
    const strings = this.tuning().strings;
    const notes = new Set<Note>();
    for (const key of this.identifyMarks()) {
      const [s, f] = key.split(':').map(Number);
      if (strings[s] !== undefined) notes.add(mod12(strings[s] + f));
    }
    return [...notes].sort((a, b) => a - b);
  });

  private readonly identifyChordTokens = computed(() =>
    this.identifyChordsInput()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  readonly identifyChords = computed<ParsedChord[]>(() =>
    this.identifyChordTokens()
      .map(parseChordName)
      .filter((c): c is ParsedChord => c !== null),
  );

  readonly identifyUnparsedChords = computed<{ raw: string; suggestion: string | null }[]>(() =>
    this.identifyChordTokens()
      .filter((t) => parseChordName(t) === null)
      .map((raw) => ({ raw, suggestion: suggestChordName(raw) })),
  );

  // Marked notes plus every tone of every chord — the full set a scale must contain.
  readonly identifyAllNotes = computed<Note[]>(() => {
    const notes = new Set<Note>(this.identifyNotes());
    for (const chord of this.identifyChords()) {
      for (const tone of buildChordTones(chord.root, chord.quality)) notes.add(tone);
    }
    return [...notes].sort((a, b) => a - b);
  });

  readonly identifyHint = computed(() => {
    const t = this.text();
    const notes = this.identifyAllNotes();
    return notes.length < IDENTIFY_MIN_NOTES
      ? t.identifyNeedMore(notes.length, IDENTIFY_MIN_NOTES)
      : t.identifySelected(notes.map((n) => noteName(n)).join(', '));
  });

  readonly identifyEnoughNotes = computed(() => this.identifyAllNotes().length >= IDENTIFY_MIN_NOTES);

  readonly identifyGroups = computed<IdentifyGroupView[]>(() =>
    identifyScales(this.identifyAllNotes(), SCALE_ORDER).map((group) => this.identifyGroupView(group)),
  );

  readonly effectiveScale = computed<ScaleName>(
    () => this.scaleOverride() ?? (this.activeKey()?.mode === 'minor' ? 'aeolian' : 'ionian'),
  );

  // CAGED boxes are picked per key/progression, not per chord — you stay in
  // one hand position for the whole progression rather than hopping shapes
  // chord to chord, so this applies uniformly to every rendered fretboard.
  readonly cagedBox = computed<FretRange | null>(() => {
    if (this.highlightMode() !== 'caged' || !this.isStandardTuning()) return null;
    const key = this.activeKey();
    return key ? cagedBoxRange(this.cagedShape(), key.root) : null;
  });

  readonly scaleNotes = computed<Note[]>(() => {
    const key = this.activeKey();
    return key ? buildScale(key.root, this.effectiveScale()) : [];
  });

  readonly scaleLabels = computed<string[]>(() => {
    const degreeLabels = SCALE_DEGREE_LABELS[this.effectiveScale()];
    if (this.labelMode() === 'degrees') return [...degreeLabels];
    return this.scaleNotes().map((n, i) => spellNote(n, degreeLabels[i]));
  });

  private toneLabelsFor(tones: Note[], quality: ChordQuality): string[] {
    const degreeLabels = CHORD_DEGREE_LABELS[quality];
    if (this.labelMode() === 'degrees') return [...degreeLabels];
    return tones.map((n, i) => spellNote(n, degreeLabels[i]));
  }

  readonly chordLayers = computed<ChordLayer[]>(() => {
    if (this.mode() !== 'progression') return [];
    const key = this.activeKey();
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
        diatonic: key ? isDiatonic(chord, key) : true,
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
      diatonic: true, // the key's own tonic triad is diatonic to itself by construction
    };
  });

  readonly detectedKeyLabel = computed(() => {
    const key = this.activeKey();
    return key ? this.keyLabel(key) : null;
  });

  // Clamped separately from carouselIndex itself: the progression can shrink (e.g. editing
  // text down to one chord) without a matching stepCarousel() call to pull the raw index back in range.
  readonly carouselDisplayIndex = computed(() =>
    Math.min(this.carouselIndex(), Math.max(this.chordLayers().length - 1, 0)),
  );

  readonly activeChordLayer = computed<ChordLayer | null>(() => {
    const layers = this.chordLayers();
    if (layers.length === 0) return null;
    return layers[this.carouselDisplayIndex()];
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
    this.identifyPreview.set(null);
    this.keyMarkMode.set(false);
    this.mode.set(mode);
  }

  toggleKeyMarkMode(): void {
    this.keyMarkMode.update((on) => !on);
  }

  toggleKeyMark(position: FretPosition): void {
    const key = fretPositionKey(position.string, position.fret);
    this.keyMarks.update((marks) => {
      const next = new Set(marks);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  clearKeyMarks(): void {
    this.keyMarks.set(new Set());
  }

  // Distinct marked notes through the current tuning, ordered by pitch class.
  readonly keyMarkedNotes = computed<Note[]>(() => {
    const strings = this.tuning().strings;
    const notes = new Set<Note>();
    for (const key of this.keyMarks()) {
      const [s, f] = key.split(':').map(Number);
      if (strings[s] !== undefined) notes.add(mod12(strings[s] + f));
    }
    return [...notes].sort((a, b) => a - b);
  });

  // Everything a host needs to persist, or null when Soloin is untouched. Only the
  // fields that differ from the defaults are included.
  getSessionState(): SoloinSessionState | null {
    const state: SoloinSessionState = {};
    const marks = marksToNumbers(this.keyMarks());
    if (marks.length) state.marks = marks;
    if (this.tuningName() !== 'standard') state.tuning = this.tuningName();
    if (this.selectedKeyIndex() > 0) state.key = this.selectedKeyIndex();
    const scale = this.scaleOverride();
    if (scale !== null) state.scale = scale;
    return Object.keys(state).length ? state : null;
  }

  // Restores a saved state completely (absent fields mean "default") and lands on Key
  // mode, where the marks live. Untrusted input: anything invalid falls back to default.
  applySessionState(state: SoloinSessionState): void {
    this.keyMarks.set(numbersToMarks(state.marks));
    this.tuningName.set(TUNINGS.some((t) => t.name === state.tuning) ? state.tuning! : 'standard');
    const key = Number.isInteger(state.key) ? this.allKeys[state.key!] : undefined;
    this.selectedKey.set(key ?? { root: 0, mode: 'major' });
    this.scaleOverride.set(SCALE_ORDER.includes(state.scale as ScaleName) ? (state.scale as ScaleName) : null);
    this.identifyPreview.set(null);
    this.keyMarkMode.set(false);
    this.mode.set('key');
  }

  // Back to the defaults for everything getSessionState covers; mode, progression
  // and display preferences are left alone.
  resetSessionState(): void {
    this.keyMarks.set(new Set());
    this.tuningName.set('standard');
    this.selectedKey.set({ root: 0, mode: 'major' });
    this.scaleOverride.set(null);
    this.identifyPreview.set(null);
    this.keyMarkMode.set(false);
  }

  isPreviewing(match: IdentifyMatch): boolean {
    const preview = this.identifyPreview();
    return preview !== null && preview.root === match.root && preview.scale === match.scale;
  }

  onChipPointerEnter(match: IdentifyMatch, event: PointerEvent): void {
    if (event.pointerType === 'mouse') this.identifyPreview.set(match);
  }

  onChipPointerLeave(match: IdentifyMatch, event: PointerEvent): void {
    if (event.pointerType === 'mouse' && this.isPreviewing(match)) this.identifyPreview.set(null);
  }

  onChipFocus(match: IdentifyMatch): void {
    this.identifyPreview.set(match);
  }

  onChipBlur(match: IdentifyMatch): void {
    if (this.isPreviewing(match)) this.identifyPreview.set(null);
  }

  onChipPointerDown(match: IdentifyMatch, event: PointerEvent): void {
    this.chipPointer = { type: event.pointerType, wasPreviewed: this.isPreviewing(match) };
  }

  // Mouse and keyboard apply straight away. A touch/pen tap on a chip that wasn't
  // already previewed only previews it; tapping the previewed chip again applies.
  onChipClick(match: IdentifyMatch): void {
    const pointer = this.chipPointer;
    this.chipPointer = null;
    if (pointer && pointer.type !== 'mouse' && !pointer.wasPreviewed) {
      this.identifyPreview.set(match);
      return;
    }
    this.applyIdentifyMatch(match);
  }

  // Some touch browsers (iOS Safari) don't focus a tapped button, so blur alone can't
  // dismiss a pinned preview: any press outside the chips does.
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.identifyPreview() && !(event.target as Element | null)?.closest?.('.identify-chip')) {
      this.identifyPreview.set(null);
    }
  }

  toggleIdentifyPosition(position: FretPosition): void {
    this.identifyPreview.set(null);
    const key = fretPositionKey(position.string, position.fret);
    this.identifyMarks.update((marks) => {
      const next = new Set(marks);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  clearIdentifyMarks(): void {
    this.identifyPreview.set(null);
    this.identifyMarks.set(new Set());
  }

  onIdentifyChordsInput(event: Event): void {
    this.identifyPreview.set(null);
    this.identifyChordsInput.set((event.target as HTMLInputElement).value);
  }

  // Leaves Identify for the normal Key view with the picked root/scale applied;
  // tuning and the marks are left as they are.
  applyIdentifyMatch(match: IdentifyMatch): void {
    this.identifyPreview.set(null);
    this.selectedKey.set({ root: match.root, mode: MINOR_FLAVOURED_SCALES.has(match.scale) ? 'minor' : 'major' });
    this.scaleOverride.set(match.scale);
    this.mode.set('key');
  }

  private matchLabel(match: IdentifyMatch): string {
    return `${noteName(match.root)} ${this.text().scaleNames[match.scale]}`;
  }

  private identifyGroupView(group: IdentifyGroup): IdentifyGroupView {
    const t = this.text();
    const headline = group.matches
      .filter((m) => IDENTIFY_HEADLINE_SCALES.includes(m.scale))
      .map((m) => {
        if (m.scale === 'ionian') return this.keyLabel({ root: m.root, mode: 'major' });
        if (m.scale === 'aeolian') return this.keyLabel({ root: m.root, mode: 'minor' });
        return this.matchLabel(m);
      })
      .join(' / ');
    // The first chord is the likeliest tonal centre: the mode rooted on it goes
    // first and is flagged, the rest keep their order.
    const homeRoot = this.identifyChords()[0]?.root;
    const chips = group.matches.map((match) => ({
      match,
      label: this.matchLabel(match),
      suggested: homeRoot !== undefined && match.root === homeRoot,
    }));
    chips.sort((a, b) => Number(b.suggested) - Number(a.suggested));
    return {
      id: group.notes.join(','),
      headline,
      noteCount: t.identifyNoteCount(group.notes.length),
      noteNames: group.notes.map((n) => noteName(n)).join(' '),
      chips,
    };
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

  setTuning(event: Event): void {
    this.identifyPreview.set(null);
    this.tuningName.set((event.target as HTMLSelectElement).value as TuningName);
  }

  setCagedShape(shape: CagedShape): void {
    this.cagedShape.set(shape);
  }

  toggleScaleNotes(event: Event): void {
    this.showScaleNotes.set((event.target as HTMLInputElement).checked);
  }

  toggleKeyMarksInProgression(event: Event): void {
    this.showKeyMarksInProgression.set((event.target as HTMLInputElement).checked);
  }

  // Read-only projection for Progression's per-chord fretboards — never the raw
  // signal directly, so a disabled/off toggle can't leak marks onto a tile.
  readonly progressionMarks = computed(() => (this.showKeyMarksInProgression() ? this.keyMarks() : NO_MARKS));

  stepCarousel(delta: number): void {
    const max = this.chordLayers().length - 1;
    this.carouselIndex.update((i) => Math.max(0, Math.min(max, i + delta)));
  }

  onProgressionInput(event: Event): void {
    this.progressionInput.set((event.target as HTMLInputElement).value);
    this.keyOverride.set(null);
  }

  selectKeyOverride(key: Key): void {
    this.keyOverride.set(key);
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
      const badge = layer.diatonic ? '' : ` (${t.nonDiatonicBadge})`;
      lines.push(`${layer.label}${badge}: ${layer.toneLabels.join(', ')}`);
    }
    const marked = this.keyMarkedNotes();
    if (this.mode() === 'key' && marked.length > 0) {
      lines.push(t.markedNotesLine(marked.map((n) => noteName(n)).join(', ')));
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
