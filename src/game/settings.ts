import { useSyncExternalStore } from 'react';

// User settings persisted in localStorage. Sound mute lives in sfx.ts (saveBooMuted).
export interface Settings {
  voice: boolean;
  reducedMotion: boolean;
  largeCaptions: boolean;
  lowPower: boolean;
  haptics: boolean;
  /** AI Mortimer: live generated lines (default on). Off = scripted lines only, zero AI network calls. */
  aiEnabled: boolean;
  /** Send the typed confession text to the AI for a reaction (default on, opt-out in the challenge). */
  aiRoast: boolean;
  /** Optional bring-your-own OpenAI-compatible endpoint. Stored only in this browser's localStorage. */
  aiBase: string;
  aiModel: string;
  aiKey: string;
}

const KEY = 'saveBooSettings';
const prefersReduced = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
};

// Only values the user changed are stored, so the OS preference keeps applying until then.
let stored: Partial<Settings> = {};
try { stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}

const build = (): Settings => ({
  voice: true,
  reducedMotion: prefersReduced(),
  largeCaptions: false,
  lowPower: false,
  haptics: true,
  aiEnabled: true,
  aiRoast: true,
  aiBase: '',
  aiModel: '',
  aiKey: '',
  ...stored,
});

let current = build();
const listeners = new Set<() => void>();

export const settings = {
  get: () => current,
  set(patch: Partial<Settings>) {
    stored = { ...stored, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
    current = build();
    listeners.forEach((f) => f());
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

export const useSettings = () => useSyncExternalStore(settings.subscribe, settings.get);

/** Optional haptic feedback on devices that support it. */
export function haptic(pattern: number | number[]) {
  if (!current.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}
