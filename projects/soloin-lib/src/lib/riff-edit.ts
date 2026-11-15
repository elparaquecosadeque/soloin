import type { ScaleName } from '@gblp/music-theory';
import { CAGED_SHAPES, type CagedShape } from './components/soloin-fretboard/caged';
import { type Riff, type RiffNote, riffBoxes } from './riffs';

// The editor's view of a riff: a plain sequence of notes and rests, each
// with a duration. Start beats are never stored — they fall out of the
// order — so changing one duration shifts everything after it for free.
export interface RiffEvent {
  duration: number;
  rest?: boolean;
  stringIndex: number;
  fretOffset: number;
  technique?: RiffNote['technique'];
  bend?: number;
  vibrato?: boolean;
  palmMute?: boolean;
  dead?: boolean;
}

export interface RiffDoc {
  name: string;
  bars: number; // 4/4 only
  span: number; // boxes covered, see Riff.span
  events: RiffEvent[];
}

export const BEATS_PER_BAR = 4;
export const MAX_BARS = 4;
export const MAX_SPAN = CAGED_SHAPES.length;

export type Technique = 'hammer' | 'pull' | 'slide' | 'bend' | 'vibrato' | 'palmMute' | 'dead';
export type TechniqueIssue = 'needsPrevious' | 'needsHigher' | 'needsLower' | 'needsOtherFret' | 'deadNote';

export function toDoc(riff: Riff, language: 'en' | 'es'): RiffDoc {
  const events: RiffEvent[] = [];
  let at = 0;
  for (const note of riff.notes) {
    if (note.beat - at > 0.001) events.push({ rest: true, duration: note.beat - at, stringIndex: 0, fretOffset: 0 });
    const { beat: _beat, ...rest } = note;
    events.push(rest);
    at = note.beat + note.duration;
  }
  return {
    name: riff.name[language],
    bars: Math.min(MAX_BARS, Math.max(1, Math.ceil(riff.totalBeats / BEATS_PER_BAR))),
    span: riff.span ?? 1,
    events,
  };
}

export function eventBeats(events: readonly RiffEvent[]): number[] {
  let at = 0;
  return events.map((e) => {
    const beat = at;
    at += e.duration;
    return beat;
  });
}

export const docLength = (events: readonly RiffEvent[]) => events.reduce((sum, e) => sum + e.duration, 0);

export function toRiff(base: Riff, doc: RiffDoc): Riff {
  const beats = eventBeats(doc.events);
  const notes: RiffNote[] = [];
  doc.events.forEach((e, i) => {
    if (e.rest) return;
    const { rest: _rest, ...note } = e;
    notes.push({ ...note, beat: beats[i] });
  });
  const name = doc.name.trim();
  return {
    id: base.id,
    name: { en: name, es: name },
    scale: base.scale,
    shape: base.shape,
    totalBeats: doc.bars * BEATS_PER_BAR,
    notes,
    ...(doc.span > 1 && { span: doc.span }),
    user: true,
  };
}

// Why `technique` can't go on events[index], or null when it can.
export function techniqueIssue(events: readonly RiffEvent[], index: number, technique: Technique): TechniqueIssue | null {
  const note = events[index];
  if (technique === 'palmMute' || technique === 'dead') return null;
  if (note.dead) return 'deadNote';
  if (technique === 'bend' || technique === 'vibrato') return null;
  // Legato and slides start from the note just before, on the same string.
  const prev = events[index - 1];
  if (!prev || prev.rest || prev.dead || prev.stringIndex !== note.stringIndex) return 'needsPrevious';
  if (technique === 'hammer' && note.fretOffset <= prev.fretOffset) return 'needsHigher';
  if (technique === 'pull' && note.fretOffset >= prev.fretOffset) return 'needsLower';
  if (technique === 'slide' && note.fretOffset === prev.fretOffset) return 'needsOtherFret';
  return null;
}

// Drops every technique an edit has made unplayable. Returns how many went.
export function normalize(events: RiffEvent[]): { events: RiffEvent[]; dropped: number } {
  let dropped = 0;
  const out: RiffEvent[] = [];
  for (const source of events) {
    const e = { ...source };
    out.push(e);
    if (e.rest) continue;
    const i = out.length - 1;
    if (e.dead && (e.bend || e.vibrato)) {
      delete e.bend;
      delete e.vibrato;
      dropped++;
    }
    if (e.technique && techniqueIssue(out, i, e.technique)) {
      delete e.technique;
      dropped++;
    }
  }
  return { events: out, dropped };
}

export function toggleTechnique(event: RiffEvent, technique: Technique): RiffEvent {
  const e = { ...event };
  if (technique === 'bend') {
    // none -> full -> half -> none
    const next = e.bend === 2 ? 1 : e.bend === 1 ? 0 : 2;
    if (next) e.bend = next;
    else delete e.bend;
  } else if (technique === 'vibrato' || technique === 'palmMute' || technique === 'dead') {
    if (e[technique]) delete e[technique];
    else e[technique] = true;
    if (e.dead) {
      delete e.bend;
      delete e.vibrato;
      delete e.technique;
    }
  } else if (e.technique === technique) delete e.technique;
  else e.technique = technique;
  return e;
}

// --- Untrusted input: localStorage and pasted codes ---

const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

export function sanitizeRiff(raw: unknown, scales: readonly ScaleName[]): Riff | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = (r['name'] as Record<string, unknown> | undefined)?.['en'];
  if (typeof r['id'] !== 'string' || typeof name !== 'string') return null;
  if (!scales.includes(r['scale'] as ScaleName) || !CAGED_SHAPES.includes(r['shape'] as CagedShape)) return null;
  const span = r['span'] === undefined ? 1 : r['span'];
  if (!isInt(span, 1, MAX_SPAN)) return null;
  const totalBeats = r['totalBeats'];
  if (!isInt(totalBeats, BEATS_PER_BAR, MAX_BARS * BEATS_PER_BAR) || !Array.isArray(r['notes'])) return null;
  const maxOffset = riffBoxes(r['shape'] as CagedShape, span).at(-1)!.end;
  const events: RiffEvent[] = [];
  let at = 0;
  for (const n of r['notes'] as Record<string, unknown>[]) {
    if (!n || typeof n !== 'object') return null;
    const { beat, duration } = n;
    if (typeof beat !== 'number' || typeof duration !== 'number' || duration <= 0 || beat < at - 0.001) return null;
    if (!isInt(n['stringIndex'], 0, 5) || !isInt(n['fretOffset'], 0, maxOffset)) return null;
    if (beat - at > 0.001) events.push({ rest: true, duration: beat - at, stringIndex: 0, fretOffset: 0 });
    const technique = n['technique'];
    events.push({
      stringIndex: n['stringIndex'],
      fretOffset: n['fretOffset'],
      duration,
      ...((technique === 'slide' || technique === 'hammer' || technique === 'pull') && { technique }),
      ...((n['bend'] === 1 || n['bend'] === 2) && { bend: n['bend'] }),
      ...(n['vibrato'] === true && { vibrato: true }),
      ...(n['palmMute'] === true && { palmMute: true }),
      ...(n['dead'] === true && { dead: true }),
    });
    at = beat + duration;
  }
  if (at > totalBeats + 0.001) return null;
  // Round-trip through the editor model so unplayable techniques never get stored.
  const base = { id: r['id'], scale: r['scale'] as ScaleName, shape: r['shape'] as CagedShape } as Riff;
  return toRiff(base, {
    name: name.slice(0, 60),
    bars: Math.ceil(totalBeats / BEATS_PER_BAR),
    span,
    events: normalize(events).events,
  });
}

// A riff as a short text code for copy/paste between devices.
export function encodeRiff(riff: Riff): string {
  const bytes = new TextEncoder().encode(JSON.stringify(riff));
  return 'soloin1.' + btoa(String.fromCharCode(...bytes));
}

export function decodeRiff(code: string, scales: readonly ScaleName[]): Riff | null {
  try {
    const body = code.trim().replace(/^soloin1\./, '');
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return sanitizeRiff(JSON.parse(new TextDecoder().decode(bytes)), scales);
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'gblp-soloin-riffs';

export function loadUserRiffs(scales: readonly ScaleName[]): Riff[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => sanitizeRiff(r, scales)).filter((r): r is Riff => r !== null);
  } catch {
    return [];
  }
}

export function saveUserRiffs(riffs: readonly Riff[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(riffs));
  } catch {
    // Private mode or a full quota: the riffs still work for this visit.
  }
}
