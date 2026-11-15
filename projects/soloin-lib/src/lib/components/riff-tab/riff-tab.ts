import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Note } from '@gblp/music-theory';
import {
  BEATS_PER_BAR,
  MAX_BARS,
  MAX_SPAN,
  type RiffDoc,
  type RiffEvent,
  type Technique,
  docLength,
  eventBeats,
  normalize,
  techniqueIssue,
  toDoc,
  toRiff,
  toggleTechnique,
} from '../../riff-edit';
import { type Riff, type RiffNote, riffBoxes } from '../../riffs';
import { RIFF_TAB_COPY } from './riff-tab.copy';

const STRING_COUNT = 6;

// TAB strip geometry
const LINE_GAP = 22;
const BEAT_W = 96; // a sixteenth (24px) still clears a two-digit fret number
const PAD_L = 30;
const PAD_T = 30;
const PAD_R = 24;
const PAD_B = 14;
const RHYTHM_H = 42; // stems/flags row under the strings, then palm-mute marks

// Zoomed fret-window geometry
const FRET_W = 64;
const STRING_GAP = 26;
const BOARD_L = 34;
const BOARD_T = 16;
const MIN_FRETS = 6;

// ponytail: octaves assume a standard-ish tuning (each string within a
// tritone of standard) — fine for every tuning in tunings.ts; pass real
// MIDI numbers per tuning if an exotic one is ever added.
const STANDARD_MIDI = [64, 59, 55, 50, 45, 40];

const TECHNIQUES: { id: Technique; mark: string }[] = [
  { id: 'hammer', mark: 'h' },
  { id: 'pull', mark: 'p' },
  { id: 'slide', mark: '/' },
  { id: 'bend', mark: 'b' },
  { id: 'vibrato', mark: '~' },
  { id: 'palmMute', mark: 'PM' },
  { id: 'dead', mark: 'x' },
];

// Riff trainer card: a zoomed fret window showing just the riff's notes, a
// TAB strip with a moving playhead, and its own play/tempo clock so a riff
// can be looped at any speed without the host transport. When not playing
// itself it still follows the host's beat (via `progress`).
//
// With `editing` on, the same card is the riff editor: tap the fret window
// (or click a TAB string and type a fret) to write notes one after another.
@Component({
  selector: 'soloin-riff-tab',
  standalone: true,
  templateUrl: './riff-tab.html',
  styleUrl: './riff-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiffTab {
  readonly riff = input.required<Riff>();
  // The box's resolved start fret (cagedBoxRange(shape, key.root).start).
  readonly boxStart = input.required<number>();
  readonly title = input('');
  readonly strings = input<readonly Note[]>([4, 11, 7, 2, 9, 4]);
  readonly scaleNotes = input<Note[]>([]);
  readonly scaleLabels = input<string[]>([]); // parallel to scaleNotes
  readonly scaleRoot = input<Note | null>(null);
  // Parallel to scaleNotes: 0 rest .. 3 tense. Null = ink dots with a red root.
  readonly scaleLevels = input<readonly number[] | null>(null);
  // 0..1 from the host transport, null while it isn't running.
  readonly progress = input<number | null>(null);
  readonly editing = input(false);
  readonly language = input<'en' | 'es'>('en');

  readonly saved = output<Riff>();
  readonly cancelled = output<void>();

  readonly copy = computed(() => RIFF_TAB_COPY[this.language()]);
  readonly techniques = TECHNIQUES;
  readonly durations = [2, 1, 0.5, 0.25];
  readonly spans = Array.from({ length: MAX_SPAN }, (_, i) => i + 1);

  readonly playing = signal(false);
  readonly bpm = signal(80);
  private readonly clock = signal(0); // beats since Play, unwrapped
  private raf = 0;
  private audio: AudioContext | null = null;
  private lastPlucked = -1;

  // --- Editor state: all of it resets whenever a different riff comes in ---
  private readonly doc = linkedSignal<RiffDoc>(() => toDoc(this.riff(), untracked(this.language)));
  private readonly past = linkedSignal<RiffDoc[]>(() => (this.riff(), []));
  private readonly future = linkedSignal<RiffDoc[]>(() => (this.riff(), []));
  private readonly renamed = linkedSignal(() => (this.riff(), false));
  // Index into doc().events; events.length means "append here".
  readonly cursor = linkedSignal(() => toDoc(this.riff(), 'en').events.length);
  readonly cursorString = signal(2);
  readonly duration = signal(0.5);
  readonly dotted = signal(false);
  readonly notice = linkedSignal(() => (this.riff(), ''));
  private typed: { at: number; string: number; index: number; text: string; placed: boolean } | null = null;

  private readonly tabScroll = viewChild<ElementRef<HTMLElement>>('tabScroll');

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
    // Keep the playhead (or the edit cursor) in view when the TAB scrolls sideways.
    effect(() => {
      const x = this.editing() && !this.playing() ? this.cursorX() : this.playheadX();
      const el = this.tabScroll()?.nativeElement;
      if (!el || el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft = Math.max(0, (x * el.scrollWidth) / this.tabWidth() - el.clientWidth / 2);
    });
  }

  // What the card draws and plays: the live draft while editing.
  readonly shown = computed<Riff>(() => (this.editing() ? toRiff(this.riff(), this.doc()) : this.riff()));
  readonly name = computed(() => this.doc().name);
  readonly bars = computed(() => this.doc().bars);
  readonly span = computed(() => this.doc().span);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  readonly selected = computed<RiffEvent | null>(() => this.doc().events[this.cursor()] ?? null);
  readonly selectedNote = computed(() => {
    const e = this.selected();
    return e && !e.rest ? e : null;
  });
  readonly activeDuration = computed(() => this.duration() * (this.dotted() ? 1.5 : 1));

  // Position in beats within the riff; null = idle.
  readonly pos = computed<number | null>(() => {
    const total = this.shown().totalBeats;
    if (total <= 0) return null;
    if (this.playing()) return this.clock() % total;
    const p = this.editing() ? null : this.progress();
    return p === null ? null : p * total;
  });

  readonly activeIndex = computed<number | null>(() => {
    const pos = this.pos();
    if (pos === null) return null;
    const i = this.shown().notes.findIndex((n) => pos >= n.beat && pos < n.beat + n.duration);
    return i === -1 ? null : i;
  });

  readonly fraction = computed(() => (this.pos() ?? 0) / Math.max(0.001, this.shown().totalBeats));

  // --- TAB strip ---
  readonly tabWidth = computed(() => PAD_L + PAD_R + Math.max(1, this.shown().totalBeats) * BEAT_W);
  // Past one bar the strip keeps its size and scrolls instead of shrinking.
  readonly tabMinWidth = computed(() => (this.shown().totalBeats > BEATS_PER_BAR ? this.tabWidth() : null));
  readonly tabHeight = PAD_T + PAD_B + RHYTHM_H + (STRING_COUNT - 1) * LINE_GAP;
  readonly stemTop = PAD_T + (STRING_COUNT - 1) * LINE_GAP + 12;
  readonly stemBottom = this.stemTop + 18;
  readonly tabLineYs = Array.from({ length: STRING_COUNT }, (_, i) => PAD_T + i * LINE_GAP);
  readonly stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];
  readonly playheadW = 30;
  // Snaps to the sounding note's column; only glides during rests.
  readonly playheadX = computed(() => {
    const i = this.activeIndex();
    const beat = i === null ? (this.pos() ?? 0) : this.shown().notes[i].beat;
    return PAD_L + beat * BEAT_W - this.playheadW / 2;
  });

  readonly beatTicks = computed(() =>
    Array.from({ length: Math.ceil(this.shown().totalBeats) }, (_, i) => ({
      x: PAD_L + i * BEAT_W,
      n: (i % BEATS_PER_BAR) + 1,
    })),
  );

  readonly barLines = computed(() =>
    Array.from(
      { length: Math.ceil(this.shown().totalBeats / BEATS_PER_BAR) - 1 },
      (_, i) => PAD_L + (i + 1) * BEATS_PER_BAR * BEAT_W - 15,
    ),
  );

  private readonly beats = computed(() => eventBeats(this.doc().events));
  readonly cursorX = computed(() => PAD_L + (this.beats()[this.cursor()] ?? docLength(this.doc().events)) * BEAT_W);
  readonly cursorY = computed(() => PAD_T + this.cursorString() * LINE_GAP);

  readonly restMarks = computed(() => {
    if (!this.editing()) return [];
    const beats = this.beats();
    const cursor = this.cursor();
    return this.doc()
      .events.map((e, i) => ({ rest: e.rest, x: PAD_L + beats[i] * BEAT_W, selected: i === cursor }))
      .filter((m) => m.rest);
  });

  readonly tabMarks = computed(() => {
    const active = this.activeIndex();
    const start = this.boxStart();
    const notes = this.shown().notes;
    // While editing, which note the cursor sits on (rests aren't notes).
    const cursor = this.cursor();
    const selected = this.editing() ? this.doc().events.slice(0, cursor + 1).filter((e) => !e.rest).length - 1 : -1;
    const onNote = this.editing() && this.selectedNote() !== null;
    return notes.map((note, i) => {
      const x = PAD_L + note.beat * BEAT_W;
      const prev = note.technique ? notes[i - 1] : undefined;
      // Rhythm: a dotted value is 1.5x a plain one; flags count down from the quarter.
      const dotted = [0.75, 1.5, 3].includes(note.duration);
      const base = dotted ? note.duration / 1.5 : note.duration;
      const afterBend = note.bend ? 28 : 12;
      return {
        x,
        y: PAD_T + note.stringIndex * LINE_GAP,
        fret: note.dead ? 'x' : String(start + note.fretOffset),
        active: i === active,
        selected: onNote && i === selected,
        technique: note.technique,
        // Where the slide line / legato arc starts: the previous note's number.
        fromX: prev ? PAD_L + prev.beat * BEAT_W : x,
        rising: prev ? note.fretOffset > prev.fretOffset : false,
        bendLabel: note.bend ? (note.bend >= 2 ? 'full' : '½') : null,
        vibrato: note.vibrato ? wave(x + afterBend, Math.min(22, Math.max(8, note.duration * BEAT_W - 26))) : null,
        palmMute: !!note.palmMute,
        flags: base <= 0.25 ? 2 : base <= 0.5 ? 1 : 0,
        dotted,
        long: base >= 2,
      };
    });
  });

  // --- Zoomed fret window ---
  readonly boxes = computed(() => riffBoxes(this.shown().shape, this.shown().span ?? 1));
  readonly windowEnd = computed(() => this.boxes().at(-1)!.end);
  readonly fretCount = computed(() =>
    Math.max(MIN_FRETS, this.windowEnd() + 1, Math.max(...this.shown().notes.map((n) => n.fretOffset)) + 1),
  );
  readonly boardWidth = computed(() => BOARD_L + this.fretCount() * FRET_W + 8);
  // Three boxes fit the card; a longer run keeps its size and scrolls. While
  // editing it never shrinks at all, so every position stays a finger-sized target.
  readonly boardMinWidth = computed(() =>
    this.editing() || this.fretCount() > 12 ? this.boardWidth() * 0.75 : null,
  );
  readonly boardHeight = BOARD_T + (STRING_COUNT - 1) * STRING_GAP + 34;
  readonly boardRight = computed(() => BOARD_L + this.fretCount() * FRET_W);
  readonly boardBottom = BOARD_T + (STRING_COUNT - 1) * STRING_GAP;
  readonly boardStringYs = Array.from({ length: STRING_COUNT }, (_, i) => BOARD_T + i * STRING_GAP);

  readonly frets = computed(() =>
    Array.from({ length: this.fretCount() }, (_, i) => ({
      lineX: BOARD_L + (i + 1) * FRET_W,
      labelX: BOARD_L + (i + 0.5) * FRET_W,
      fret: this.boxStart() + i,
    })),
  );

  // One tinted band per box, only when the riff runs through more than one.
  readonly boxBands = computed(() => {
    const boxes = this.boxes();
    if (boxes.length < 2) return [];
    return boxes.map((box, i) => ({
      x: BOARD_L + box.start * FRET_W,
      width: (box.end - box.start + 1) * FRET_W,
      labelX: BOARD_L + (box.start + 0.5) * FRET_W,
      shape: box.shape,
      alt: i % 2 === 1,
    }));
  });

  private pitchClass(stringIndex: number, fretOffset: number): Note {
    return ((this.strings()[stringIndex] + this.boxStart() + fretOffset) % 12) as Note;
  }

  readonly dots = computed(() => {
    const riff = this.shown();
    const active = this.activeIndex();
    const activeNote = active === null ? null : riff.notes[active];
    const chosen = this.editing() && !this.playing() ? this.selectedNote() : null;
    const notes = this.scaleNotes();
    const labels = this.scaleLabels();
    const root = this.scaleRoot();
    const levels = this.scaleLevels();
    const seen = new Map<
      string,
      { x: number; y: number; label: string; root: boolean; active: boolean; level: number | null }
    >();
    for (const n of riff.notes) {
      const key = `${n.stringIndex}:${n.fretOffset}`;
      if (seen.has(key)) continue;
      const pc = this.pitchClass(n.stringIndex, n.fretOffset);
      const lit = activeNote ?? chosen;
      seen.set(key, {
        x: BOARD_L + (n.fretOffset + 0.5) * FRET_W,
        y: BOARD_T + n.stringIndex * STRING_GAP,
        label: labels[notes.indexOf(pc)] ?? '',
        root: pc === root,
        // A note outside the scale is as tense as it gets.
        level: levels ? (levels[notes.indexOf(pc)] ?? 3) : null,
        active: lit?.stringIndex === n.stringIndex && lit.fretOffset === n.fretOffset,
      });
    }
    return [...seen.values()];
  });

  // While editing: every position in the window is a tap target, and the
  // scale's own notes show through faintly as a guide.
  readonly cells = computed(() => {
    if (!this.editing()) return [];
    const notes = this.scaleNotes();
    const labels = this.scaleLabels();
    const cells: { s: number; f: number; x: number; y: number; label: string | null }[] = [];
    for (let s = 0; s < STRING_COUNT; s++) {
      for (let f = 0; f <= this.windowEnd(); f++) {
        const i = notes.indexOf(this.pitchClass(s, f));
        cells.push({
          s,
          f,
          x: BOARD_L + (f + 0.5) * FRET_W,
          y: BOARD_T + s * STRING_GAP,
          label: i === -1 ? null : (labels[i] ?? ''),
        });
      }
    }
    return cells;
  });

  readonly fretW = FRET_W;
  readonly stringGap = STRING_GAP;

  // --- Editing ---
  private say(message: string): void {
    this.notice.set(message);
  }

  // Every edit goes through here: fit the bar count, drop techniques the
  // edit made unplayable, and remember the previous state for undo.
  private commit(next: RiffDoc): boolean {
    const needed = Math.ceil(docLength(next.events) / BEATS_PER_BAR - 0.001);
    if (needed > MAX_BARS) {
      this.say(this.copy().full);
      return false;
    }
    const { events, dropped } = normalize(next.events);
    this.past.update((p) => [...p, this.doc()]);
    this.future.set([]);
    this.doc.set({ ...next, events, bars: Math.max(next.bars, needed, 1) });
    this.say(dropped ? this.copy().dropped : '');
    return true;
  }

  private place(index: number, stringIndex: number, fretOffset: number): boolean {
    const doc = this.doc();
    const events = [...doc.events];
    const existing = events[index];
    if (existing) {
      const { rest: _rest, ...kept } = existing;
      events[index] = { ...kept, stringIndex, fretOffset };
    } else {
      events[index] = { stringIndex, fretOffset, duration: this.activeDuration() };
    }
    if (!this.commit({ ...doc, events })) return false;
    if (!existing) this.cursor.set(events.length);
    this.pluckNote(this.doc().events[index] as RiffNote);
    return true;
  }

  // Fret-window tap.
  enter(stringIndex: number, fretOffset: number): void {
    this.cursorString.set(stringIndex);
    this.typed = null;
    this.place(this.cursor(), stringIndex, fretOffset);
  }

  // TAB entry: digits typed on the cursor's string. Two quick digits make one fret.
  private typeDigit(digit: string): void {
    const now = performance.now();
    const string = this.cursorString();
    const cursor = this.cursor();
    const t = this.typed;
    const follows =
      t !== null &&
      now - t.at < 900 &&
      t.string === string &&
      (cursor === t.index || (t.placed && cursor === t.index + 1));
    const tryPlace = (text: string, index: number): boolean => {
      const offset = Number(text) - this.boxStart();
      if (offset < 0 || offset > this.windowEnd()) return false;
      return this.place(index, string, offset);
    };
    if (follows && tryPlace(t.text + digit, t.index)) {
      this.typed = null;
      return;
    }
    const index = follows && !t.placed ? t.index : cursor;
    const placed = tryPlace(digit, index);
    if (!placed) this.say(this.copy().outside(this.boxStart(), this.boxStart() + this.windowEnd()));
    this.typed = { at: now, string, index, text: digit, placed };
  }

  setDuration(duration: number): void {
    this.duration.set(duration);
    this.resize();
  }

  toggleDotted(): void {
    this.dotted.update((d) => !d);
    this.resize();
  }

  // A duration change also applies to the event under the cursor, if any.
  private resize(): void {
    const doc = this.doc();
    const i = this.cursor();
    if (!doc.events[i]) return;
    const events = [...doc.events];
    events[i] = { ...events[i], duration: this.activeDuration() };
    this.commit({ ...doc, events });
  }

  addRest(): void {
    const doc = this.doc();
    const i = this.cursor();
    const events = [...doc.events];
    const existing = events[i];
    events[i] = { rest: true, duration: existing?.duration ?? this.activeDuration(), stringIndex: 0, fretOffset: 0 };
    if (this.commit({ ...doc, events }) && !existing) this.cursor.set(events.length);
  }

  remove(): void {
    const doc = this.doc();
    if (doc.events.length === 0) return;
    const i = Math.min(this.cursor(), doc.events.length - 1);
    if (this.commit({ ...doc, events: doc.events.filter((_, j) => j !== i) })) this.cursor.set(i);
  }

  techniqueOn(technique: Technique): boolean {
    const note = this.selectedNote();
    if (!note) return false;
    return technique === 'bend' || technique === 'vibrato' || technique === 'palmMute' || technique === 'dead'
      ? !!note[technique]
      : note.technique === technique;
  }

  techniqueBlocked(technique: Technique): boolean {
    return !this.techniqueOn(technique) && techniqueIssue(this.doc().events, this.cursor(), technique) !== null;
  }

  applyTechnique(technique: Technique): void {
    const doc = this.doc();
    const i = this.cursor();
    if (!this.selectedNote()) return;
    const issue = this.techniqueOn(technique) ? null : techniqueIssue(doc.events, i, technique);
    if (issue) {
      this.say(this.copy().issues[issue]);
      return;
    }
    const events = [...doc.events];
    events[i] = toggleTechnique(events[i], technique);
    if (this.commit({ ...doc, events })) this.pluckNote(this.doc().events[i] as RiffNote);
  }

  setBars(delta: number): void {
    const doc = this.doc();
    const bars = doc.bars + delta;
    if (bars < 1 || bars > MAX_BARS) return;
    if (bars * BEATS_PER_BAR < docLength(doc.events) - 0.001) {
      this.say(this.copy().barsBlocked);
      return;
    }
    this.past.update((p) => [...p, doc]);
    this.future.set([]);
    this.doc.set({ ...doc, bars });
    this.say('');
  }

  setSpan(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const doc = this.doc();
    const span = Number(select.value);
    const end = riffBoxes(this.riff().shape, span).at(-1)!.end;
    if (doc.events.some((e) => !e.rest && e.fretOffset > end)) {
      this.say(this.copy().spanBlocked);
      select.value = String(doc.span);
      return;
    }
    this.commit({ ...doc, span });
  }

  spanLabel(span: number): string {
    return riffBoxes(this.riff().shape, span).at(-1)!.shape;
  }

  setName(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.doc.update((d) => ({ ...d, name }));
    this.renamed.set(true);
  }

  undo(): void {
    const past = this.past();
    if (past.length === 0) return;
    this.future.update((f) => [...f, this.doc()]);
    this.restore(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
  }

  redo(): void {
    const future = this.future();
    if (future.length === 0) return;
    this.past.update((p) => [...p, this.doc()]);
    this.restore(future[future.length - 1]);
    this.future.set(future.slice(0, -1));
  }

  private restore(doc: RiffDoc): void {
    // The name isn't part of undo history, so keep whatever is typed now.
    // A cursor waiting at the end keeps waiting at the end, so writing carries on.
    const atEnd = this.cursor() >= this.doc().events.length;
    this.doc.set({ ...doc, name: this.doc().name });
    this.cursor.update((c) => (atEnd ? doc.events.length : Math.min(c, doc.events.length)));
    this.say('');
  }

  save(): void {
    const riff = toRiff(this.riff(), this.doc());
    if (riff.notes.length === 0) {
      this.say(this.copy().empty);
      return;
    }
    this.stop();
    this.saved.emit(riff);
  }

  cancel(): void {
    if ((this.canUndo() || this.renamed()) && !confirm(this.copy().discard)) return;
    this.stop();
    this.cancelled.emit();
  }

  onTabClick(event: MouseEvent): void {
    if (!this.editing()) return;
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * this.tabWidth();
    const y = ((event.clientY - box.top) / box.height) * this.tabHeight;
    const string = Math.round((y - PAD_T) / LINE_GAP);
    this.cursorString.set(Math.min(STRING_COUNT - 1, Math.max(0, string)));
    // The event whose column the click falls in; past the last one = append.
    const beat = (x - PAD_L + 12) / BEAT_W;
    const beats = this.beats();
    const events = this.doc().events;
    const hit = events.findIndex((e, i) => beat >= beats[i] && beat < beats[i] + e.duration);
    this.cursor.set(hit === -1 ? events.length : hit);
    this.typed = null;
    svg.focus();
  }

  onTabKey(event: KeyboardEvent): void {
    if (!this.editing()) return;
    const key = event.key;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && key.toLowerCase() === 'z') event.shiftKey ? this.redo() : this.undo();
    else if (mod && key.toLowerCase() === 'y') this.redo();
    else if (mod || event.altKey) return;
    else if (/^\d$/.test(key)) this.typeDigit(key);
    else if (key === 'ArrowLeft') this.cursor.update((c) => Math.max(0, c - 1));
    else if (key === 'ArrowRight') this.cursor.update((c) => Math.min(this.doc().events.length, c + 1));
    else if (key === 'ArrowUp') this.cursorString.update((s) => Math.max(0, s - 1));
    else if (key === 'ArrowDown') this.cursorString.update((s) => Math.min(STRING_COUNT - 1, s + 1));
    else if (key === 'Delete' || key === 'Backspace') this.remove();
    else return;
    event.preventDefault();
  }

  // --- Own clock ---
  private stop(): void {
    this.playing.set(false);
    cancelAnimationFrame(this.raf);
  }

  toggle(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    this.clock.set(0);
    this.lastPlucked = -1;
    this.playing.set(true);
    let last = performance.now();
    const tick = (now: number) => {
      // Advance by delta so a tempo change mid-loop doesn't jump the playhead.
      this.clock.update((c) => c + ((now - last) / 60000) * this.bpm());
      last = now;
      const i = this.activeIndex();
      if (i !== null && i !== this.lastPlucked) this.pluckNote(this.shown().notes[i]);
      this.lastPlucked = i ?? -1;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  adjustBpm(delta: number): void {
    this.bpm.update((b) => Math.min(200, Math.max(40, b + delta)));
  }

  private pluckNote(note: RiffNote): void {
    // Only ever reached from a tap, a key press or Play, so the context may start here.
    const ctx = (this.audio ??= new AudioContext());
    void ctx.resume();
    const si = note.stringIndex;
    const standardPc = STANDARD_MIDI[si] % 12;
    const detune = ((this.strings()[si] - standardPc + 18) % 12) - 6;
    const midi = STANDARD_MIDI[si] + detune + this.boxStart() + note.fretOffset;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 440 * 2 ** ((midi - 69) / 12);
    osc.frequency.setValueAtTime(freq, now);
    if (note.bend) osc.frequency.linearRampToValueAtTime(freq * 2 ** (note.bend / 12), now + 0.18);
    if (note.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = freq * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(now + 0.08);
      lfo.stop(now + 0.5);
    }
    // Slides, hammer-ons and pull-offs aren't re-picked, so they sound softer.
    gain.gain.setValueAtTime(note.technique ? 0.15 : 0.25, now);
    // A dead note is a pitchless thud; a palm-muted one dies away early.
    const decay = note.dead ? 0.04 : note.palmMute ? 0.14 : 0.45;
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    if (note.dead || note.palmMute) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = note.dead ? 400 : 900;
      osc.connect(filter).connect(gain);
    } else osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }
}

// A wavy vibrato line starting at x, drawn relative to the note's string (y = 0).
function wave(x: number, width: number): string {
  let d = `M${x} 0`;
  for (let i = 0; i < Math.round(width / 4); i++) d += ` q2 ${i % 2 ? 5 : -5} 4 0`;
  return d;
}
