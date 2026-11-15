import type { Technique, TechniqueIssue } from '../../riff-edit';

export interface RiffTabCopy {
  play: string;
  pause: string;
  slower: string;
  faster: string;
  name: string;
  namePlaceholder: string;
  bars: string;
  fewerBars: string;
  moreBars: string;
  through: string;
  durations: Record<number, string>;
  dotted: string;
  rest: string;
  undo: string;
  redo: string;
  remove: string;
  save: string;
  cancel: string;
  hint: string;
  techniques: Record<Technique, string>;
  issues: Record<TechniqueIssue, string>;
  full: string;
  dropped: string;
  barsBlocked: string;
  spanBlocked: string;
  empty: string;
  discard: string;
  outside: (low: number, high: number) => string;
}

export const RIFF_TAB_COPY: Record<'en' | 'es', RiffTabCopy> = {
  en: {
    play: 'Play',
    pause: 'Pause',
    slower: 'Slower',
    faster: 'Faster',
    name: 'Riff name',
    namePlaceholder: 'Name your riff',
    bars: 'Bars',
    fewerBars: 'Remove a bar',
    moreBars: 'Add a bar',
    through: 'Through box',
    durations: { 2: 'Half note', 1: 'Quarter note', 0.5: 'Eighth note', 0.25: 'Sixteenth note' },
    dotted: 'Dotted',
    rest: 'Rest',
    undo: 'Undo',
    redo: 'Redo',
    remove: 'Delete note',
    save: 'Save riff',
    cancel: 'Cancel',
    hint: 'Tap the fretboard to write a note, or click a string in the TAB and type the fret.',
    techniques: {
      hammer: 'Hammer-on',
      pull: 'Pull-off',
      slide: 'Slide',
      bend: 'Bend',
      vibrato: 'Vibrato',
      palmMute: 'Palm mute',
      dead: 'Dead note',
    },
    issues: {
      needsPrevious: 'This needs a note just before it on the same string.',
      needsHigher: 'A hammer-on goes to a higher fret on the same string.',
      needsLower: 'A pull-off goes to a lower fret on the same string.',
      needsOtherFret: 'A slide needs two different frets on the same string.',
      deadNote: 'A dead note has no pitch to bend or shake. Turn off the x first.',
    },
    full: 'Four bars is the limit. Shorten a note or delete one to make room.',
    dropped: 'Removed a technique that no longer fits after that change.',
    barsBlocked: 'That bar still has notes in it. Delete them first.',
    spanBlocked: 'Some notes sit past that box. Delete them first.',
    empty: 'Write at least one note before saving.',
    discard: 'Discard the changes to this riff?',
    outside: (low, high) => `This riff covers frets ${low} to ${high}.`,
  },
  es: {
    play: 'Reproducir',
    pause: 'Pausar',
    slower: 'Más lento',
    faster: 'Más rápido',
    name: 'Nombre del riff',
    namePlaceholder: 'Ponle nombre a tu riff',
    bars: 'Compases',
    fewerBars: 'Quitar un compás',
    moreBars: 'Añadir un compás',
    through: 'Hasta la caja',
    durations: { 2: 'Blanca', 1: 'Negra', 0.5: 'Corchea', 0.25: 'Semicorchea' },
    dotted: 'Con puntillo',
    rest: 'Silencio',
    undo: 'Deshacer',
    redo: 'Rehacer',
    remove: 'Borrar nota',
    save: 'Guardar riff',
    cancel: 'Cancelar',
    hint: 'Toca el diapasón para escribir una nota, o haz clic en una cuerda del TAB y teclea el traste.',
    techniques: {
      hammer: 'Hammer-on',
      pull: 'Pull-off',
      slide: 'Slide',
      bend: 'Bend',
      vibrato: 'Vibrato',
      palmMute: 'Palm mute',
      dead: 'Nota muerta',
    },
    issues: {
      needsPrevious: 'Necesita una nota justo antes en la misma cuerda.',
      needsHigher: 'Un hammer-on va a un traste más alto en la misma cuerda.',
      needsLower: 'Un pull-off va a un traste más bajo en la misma cuerda.',
      needsOtherFret: 'Un slide necesita dos trastes distintos en la misma cuerda.',
      deadNote: 'Una nota muerta no tiene tono que estirar ni vibrar. Quita primero la x.',
    },
    full: 'El límite son cuatro compases. Acorta una nota o borra alguna para hacer sitio.',
    dropped: 'Se quitó una técnica que ya no encaja tras ese cambio.',
    barsBlocked: 'Ese compás todavía tiene notas. Bórralas primero.',
    spanBlocked: 'Hay notas más allá de esa caja. Bórralas primero.',
    empty: 'Escribe al menos una nota antes de guardar.',
    discard: '¿Descartar los cambios de este riff?',
    outside: (low, high) => `Este riff cubre los trastes ${low} a ${high}.`,
  },
};
