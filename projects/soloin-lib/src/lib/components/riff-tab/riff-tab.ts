import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import type { Note } from '@gblp/music-theory';
import type { Riff } from '../../riffs';

const STRING_COUNT = 6;

// TAB strip geometry
const LINE_GAP = 22;
const BEAT_W = 96; // a sixteenth (24px) still clears a two-digit fret number
const PAD_L = 30;
const PAD_T = 30;
const PAD_R = 24;
const PAD_B = 14;
const RHYTHM_H = 30; // stems/flags row under the strings

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

// Riff trainer card: a zoomed fret window showing just the riff's notes, a
// TAB strip with a moving playhead, and its own play/tempo clock so a riff
// can be looped at any speed without the host transport. When not playing
// itself it still follows the host's beat (via `progress`).
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
  // 0..1 from the host transport, null while it isn't running.
  readonly progress = input<number | null>(null);

  readonly playing = signal(false);
  readonly bpm = signal(80);
  private readonly clock = signal(0); // beats since Play, unwrapped
  private raf = 0;
  private audio: AudioContext | null = null;
  private lastPlucked = -1;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  // Position in beats within the riff; null = idle.
  readonly pos = computed<number | null>(() => {
    const total = this.riff().totalBeats;
    if (total <= 0) return null;
    if (this.playing()) return this.clock() % total;
    const p = this.progress();
    return p === null ? null : p * total;
  });

  readonly activeIndex = computed<number | null>(() => {
    const pos = this.pos();
    if (pos === null) return null;
    const i = this.riff().notes.findIndex((n) => pos >= n.beat && pos < n.beat + n.duration);
    return i === -1 ? null : i;
  });

  readonly fraction = computed(() => (this.pos() ?? 0) / Math.max(0.001, this.riff().totalBeats));

  // --- TAB strip ---
  readonly tabWidth = computed(() => PAD_L + PAD_R + Math.max(1, this.riff().totalBeats) * BEAT_W);
  readonly tabHeight = PAD_T + PAD_B + RHYTHM_H + (STRING_COUNT - 1) * LINE_GAP;
  readonly stemTop = PAD_T + (STRING_COUNT - 1) * LINE_GAP + 12;
  readonly stemBottom = this.stemTop + 18;
  readonly tabLineYs = Array.from({ length: STRING_COUNT }, (_, i) => PAD_T + i * LINE_GAP);
  readonly stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];
  readonly playheadW = 30;
  // Snaps to the sounding note's column; only glides during rests.
  readonly playheadX = computed(() => {
    const i = this.activeIndex();
    const beat = i === null ? (this.pos() ?? 0) : this.riff().notes[i].beat;
    return PAD_L + beat * BEAT_W - this.playheadW / 2;
  });

  readonly beatTicks = computed(() =>
    Array.from({ length: Math.ceil(this.riff().totalBeats) }, (_, i) => ({ x: PAD_L + i * BEAT_W, n: i + 1 })),
  );

  readonly tabMarks = computed(() => {
    const active = this.activeIndex();
    const start = this.boxStart();
    const notes = this.riff().notes;
    return notes.map((note, i) => {
      const x = PAD_L + note.beat * BEAT_W;
      const prev = note.technique ? notes[i - 1] : undefined;
      // Rhythm: a dotted value is 1.5x a plain one; flags count down from the quarter.
      const dotted = [0.75, 1.5, 3].includes(note.duration);
      const base = dotted ? note.duration / 1.5 : note.duration;
      return {
        x,
        y: PAD_T + note.stringIndex * LINE_GAP,
        fret: start + note.fretOffset,
        active: i === active,
        technique: note.technique,
        // Where the slide line / legato arc starts: the previous note's number.
        fromX: prev ? PAD_L + prev.beat * BEAT_W : x,
        rising: prev ? note.fretOffset > prev.fretOffset : false,
        bendLabel: note.bend ? (note.bend >= 2 ? 'full' : '½') : null,
        flags: base <= 0.25 ? 2 : base <= 0.5 ? 1 : 0,
        dotted,
        long: base >= 2,
      };
    });
  });

  // --- Zoomed fret window ---
  readonly fretCount = computed(() =>
    Math.max(MIN_FRETS, Math.max(...this.riff().notes.map((n) => n.fretOffset)) + 1),
  );
  readonly boardWidth = computed(() => BOARD_L + this.fretCount() * FRET_W + 8);
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

  readonly dots = computed(() => {
    const riff = this.riff();
    const active = this.activeIndex();
    const activeNote = active === null ? null : riff.notes[active];
    const strings = this.strings();
    const notes = this.scaleNotes();
    const labels = this.scaleLabels();
    const root = this.scaleRoot();
    const seen = new Map<string, { x: number; y: number; label: string; root: boolean; active: boolean }>();
    for (const n of riff.notes) {
      const key = `${n.stringIndex}:${n.fretOffset}`;
      if (seen.has(key)) continue;
      const pc = ((strings[n.stringIndex] + this.boxStart() + n.fretOffset) % 12) as Note;
      seen.set(key, {
        x: BOARD_L + (n.fretOffset + 0.5) * FRET_W,
        y: BOARD_T + n.stringIndex * STRING_GAP,
        label: labels[notes.indexOf(pc)] ?? '',
        root: pc === root,
        active: activeNote?.stringIndex === n.stringIndex && activeNote.fretOffset === n.fretOffset,
      });
    }
    return [...seen.values()];
  });

  // --- Own clock ---
  toggle(): void {
    if (this.playing()) {
      this.playing.set(false);
      cancelAnimationFrame(this.raf);
      return;
    }
    this.audio ??= new AudioContext();
    void this.audio.resume();
    this.clock.set(0);
    this.lastPlucked = -1;
    this.playing.set(true);
    let last = performance.now();
    const tick = (now: number) => {
      // Advance by delta so a tempo change mid-loop doesn't jump the playhead.
      this.clock.update((c) => c + ((now - last) / 60000) * this.bpm());
      last = now;
      const i = this.activeIndex();
      if (i !== null && i !== this.lastPlucked) this.pluck(i);
      this.lastPlucked = i ?? -1;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  adjustBpm(delta: number): void {
    this.bpm.update((b) => Math.min(200, Math.max(40, b + delta)));
  }

  private pluck(index: number): void {
    const ctx = this.audio;
    if (!ctx) return;
    const note = this.riff().notes[index];
    const si = note.stringIndex;
    const standardPc = STANDARD_MIDI[si] % 12;
    const detune = ((this.strings()[si] - standardPc + 18) % 12) - 6;
    const midi = STANDARD_MIDI[si] + detune + this.boxStart() + note.fretOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const freq = 440 * 2 ** ((midi - 69) / 12);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (note.bend) osc.frequency.linearRampToValueAtTime(freq * 2 ** (note.bend / 12), ctx.currentTime + 0.18);
    // Slides, hammer-ons and pull-offs aren't re-picked, so they sound softer.
    gain.gain.setValueAtTime(note.technique ? 0.15 : 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }
}
