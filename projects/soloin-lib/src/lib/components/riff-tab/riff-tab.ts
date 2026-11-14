import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Riff } from '../../riffs';

interface TabMark {
  x: number;
  y: number;
  fret: number;
  active: boolean;
}

const STRING_COUNT = 6;
const LINE_GAP = 20;
const BEAT_W = 36;
const PAD_L = 28;
const PAD_T = 16;
const PAD_R = 20;
const PAD_B = 16;

// Plain tab strip: six string lines, one number per note at its beat
// position, the currently-sounding note highlighted. No bends/slides/
// hammer-ons notation and no draggable scrubber — Soloin rides the host's
// transport instead of owning a clock (see SoloinBeatEvent), so there's no
// position to seek to; the fill bar below is readout-only.
@Component({
  selector: 'soloin-riff-tab',
  standalone: true,
  templateUrl: './riff-tab.html',
  styleUrl: './riff-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiffTab {
  readonly riff = input.required<Riff>();
  // The box's resolved start fret (cagedBoxRange(shape, key.root).start) —
  // this component only ever renders absolute frets, never offsets.
  readonly boxStart = input.required<number>();
  readonly activeNoteIndex = input<number | null>(null);
  // 0..1, null while not playing — drives the readout-only fill bar.
  readonly progress = input<number | null>(null);
  readonly progressPercent = computed(() => {
    const p = this.progress();
    return p === null ? null : Math.round(p * 100);
  });

  readonly width = computed(() => PAD_L + PAD_R + Math.max(1, this.riff().totalBeats) * BEAT_W);
  readonly height = PAD_T + PAD_B + (STRING_COUNT - 1) * LINE_GAP;

  readonly stringYs = Array.from({ length: STRING_COUNT }, (_, i) => PAD_T + i * LINE_GAP);

  readonly marks = computed<TabMark[]>(() => {
    const active = this.activeNoteIndex();
    const start = this.boxStart();
    return this.riff().notes.map((note, i) => ({
      x: PAD_L + note.beat * BEAT_W,
      y: PAD_T + note.stringIndex * LINE_GAP,
      fret: start + note.fretOffset,
      active: i === active,
    }));
  });
}
