import { useEffect } from 'react';
import { settings, useSettings } from '../game/settings';

interface Props { muted: boolean; onMute: () => void; voiceNote: string; onClose: () => void }

export function SettingsPanel({ muted, onMute, voiceNote, onClose }: Props) {
  const s = useSettings();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const row = (id: string, label: string, on: boolean, toggle: () => void) => (
    <label className="setrow" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={toggle} />
    </label>
  );
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings">
        <h2>Settings</h2>
        {row('setSound', 'Sound effects and voice', !muted, onMute)}
        {row('setVoice', 'Spoken voice (off = subtitles only)', s.voice, () => settings.set({ voice: !s.voice }))}
        {row('setReduced', 'Reduce motion (no shake, no runaway box, no confetti)', s.reducedMotion, () => settings.set({ reducedMotion: !s.reducedMotion }))}
        {row('setLarge', 'Large captions', s.largeCaptions, () => settings.set({ largeCaptions: !s.largeCaptions }))}
        {row('setLow', 'Low power mode (lighter 3D)', s.lowPower, () => settings.set({ lowPower: !s.lowPower }))}
        {row('setHaptics', 'Vibration feedback', s.haptics, () => settings.set({ haptics: !s.haptics }))}
        {voiceNote && <p className="hint">{voiceNote}</p>}
        <div className="center"><button id="settingsClose" autoFocus onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
