// Web Audio synth: themes-as-data music plus a tiny SFX set. No audio files.
// Story-agnostic — themes come from a story's manifest (AudioTheme in core
// types); a story without an audio config is simply silent.
//
// The themes-as-data model (bpm/prog/scale/style/gain) and the lookahead-
// scheduler + fail-silent architecture are adapted from AngelJaimer's
// pointclick-adventure kit (audio/engine.ts), under its "yours to reuse" grant
// (see NOTICE); the voices/synthesis below are our own. The scheduler pattern
// itself is the standard Web Audio "lookahead" (Chris Wilson, A Tale of Two
// Clocks).
//
// Browsers require a user gesture before audio starts: call init() from a
// click handler. Every entry point is a no-op until then, so the engine can
// call setTheme/sfx unconditionally.

import type { AudioTheme } from '../core/types.ts';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let themeGain: GainNode | null = null;
// Mute persists across visits.
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('pcc:muted') === '1';

let theme: AudioTheme | null = null;
let schedulerId: ReturnType<typeof setInterval> | null = null;
let nextNoteTime = 0;
let halfBeat = 0;

const LOOKAHEAD_S = 0.18;
const TICK_MS = 60;

export function init(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  themeGain = ctx.createGain();
  themeGain.gain.value = 0;
  themeGain.connect(master);
}

export function toggleMute(): boolean {
  muted = !muted;
  localStorage.setItem('pcc:muted', muted ? '1' : '0');
  if (ctx && master) master.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.1);
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

function midiToFreq(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "Am" → { root pitch-class 9, minor }. Unknown chords fall back to C major. */
function parseChord(name: string): { pc: number; minor: boolean } {
  const pc = PITCH_CLASS[name[0]?.toUpperCase() ?? 'C'] ?? 0;
  return { pc, minor: name.endsWith('m') };
}

function voice(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  out: GainNode,
): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + 0.015);
  env.gain.exponentialRampToValueAtTime(0.001, at + dur);
  osc.connect(env);
  env.connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function scheduleTheme(): void {
  if (!ctx || !themeGain || !theme) return;
  const spb = 60 / theme.bpm;
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD_S) {
    const bar = Math.floor(halfBeat / 8); // 4 beats per chord
    const chord = parseChord(theme.prog[bar % theme.prog.length]!);
    const beatInBar = (halfBeat % 8) / 2;
    if (theme.style === 'drone') {
      if (halfBeat % 8 === 0) {
        voice(midiToFreq(36 + chord.pc), nextNoteTime, spb * 4.2, 'triangle', 0.16, themeGain);
        voice(midiToFreq(43 + chord.pc), nextNoteTime, spb * 4.2, 'sine', 0.1, themeGain);
      }
    } else {
      // pluck: bass on beats 0/2, sparse melody from the scale
      if (beatInBar === 0 || beatInBar === 2) {
        voice(midiToFreq(33 + chord.pc), nextNoteTime, spb * 0.9, 'triangle', 0.14, themeGain);
      }
      if (Math.random() < 0.45) {
        const note = theme.scale[Math.floor(Math.random() * theme.scale.length)]!;
        voice(midiToFreq(note), nextNoteTime, spb * 0.6, 'sine', 0.08, themeGain);
      }
    }
    nextNoteTime += spb / 2;
    halfBeat++;
  }
}

/** Switch (or stop, with null) the looping theme, with a short crossfade. */
export function setTheme(next: AudioTheme | null): void {
  theme = next;
  if (!ctx || !themeGain) return; // remembered; applied when init() runs
  if (schedulerId !== null) {
    clearInterval(schedulerId);
    schedulerId = null;
  }
  themeGain.gain.cancelScheduledValues(ctx.currentTime);
  themeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  if (next) {
    const target = next.gain ?? 0.8;
    nextNoteTime = ctx.currentTime + 0.4;
    halfBeat = 0;
    themeGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
    schedulerId = setInterval(scheduleTheme, TICK_MS);
  }
}

/** Call from a user-gesture handler; safe to call repeatedly. */
export function ensureRunning(): void {
  const hadCtx = ctx !== null;
  init();
  // First gesture: the remembered theme starts now.
  if (!hadCtx && theme) setTheme(theme);
}

export type SfxName = 'pickup' | 'door' | 'success';

export function sfx(name: SfxName): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  if (name === 'pickup') {
    voice(660, t, 0.09, 'square', 0.06, master);
    voice(990, t + 0.07, 0.12, 'square', 0.06, master);
  } else if (name === 'door') {
    voice(110, t, 0.25, 'triangle', 0.14, master);
    voice(82, t + 0.05, 0.3, 'triangle', 0.1, master);
  } else {
    [523, 659, 784, 1047].forEach((f, i) => voice(f, t + i * 0.09, 0.22, 'triangle', 0.08, master!));
  }
}
