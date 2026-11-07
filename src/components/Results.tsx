import { useState } from 'react';

export interface RunStats { secs: number; mistakes: number; hints: number; assists: number }

export function rate(s: RunStats): { title: string; pct: number } {
  const pct = Math.round(Math.max(1, Math.min(100,
    100 - s.mistakes * 4 - s.hints * 2 - s.assists * 12 - Math.max(0, s.secs - 150) / 12)));
  let title: string;
  if (s.assists >= 2) title = 'Human With a Ghostly Guardian';
  else if (s.mistakes === 0 && s.hints === 0 && s.secs < 150) title = 'Suspiciously Perfect Human';
  else if (s.mistakes <= 2 && s.secs < 240) title = 'Certified Organic Human';
  else if (s.mistakes <= 6) title = 'Mostly Human, Slightly Spectral';
  else if (s.secs > 600) title = 'Human, But Very Slowly';
  else title = 'Barely Human (We Love You Anyway)';
  return { title, pct };
}

const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;

export function Results({ stats, onAgain }: { stats: RunStats; onAgain: () => void }) {
  const { title, pct } = rate(stats);
  const [note, setNote] = useState('');
  const link = /^https?:/.test(location.protocol) ? ` ${location.origin}${location.pathname}` : '';
  const text = `I saved Boo the baby ghost in ${fmt(stats.secs)} with ${stats.mistakes} mistake${stats.mistakes === 1 ? '' : 's'}. Humanity rating: ${pct}%, "${title}". Can you beat that?${link}`;

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Save Boo', text }); setNote('Shared!'); return; }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try { await navigator.clipboard.writeText(text); setNote('Copied to clipboard!'); }
    catch (e) { setNote(text); }
  };

  return (
    <div className="center results" data-challenge="results">
      <p className="big" aria-hidden="true">🎉👻🎉</p>
      <h2 id="rating">Humanity Rating: {pct}%</h2>
      <p className="title" id="ratingTitle">{title}</p>
      <ul className="stats" aria-label="Run stats">
        <li><b>{fmt(stats.secs)}</b><span>time</span></li>
        <li><b>{stats.mistakes}</b><span>mistakes</span></li>
        <li><b>{stats.hints}</b><span>hints</span></li>
        <li><b>{stats.assists}</b><span>assists</span></li>
      </ul>
      <p className="hint">Mortimer's secret: there was no verification. He just wanted to see how far a human would go for a baby ghost. Which, frankly, is the most human thing of all.</p>
      <div className="row">
        <button id="share" autoFocus onClick={share}>Share result</button>
        <button id="again" onClick={onAgain}>Play again</button>
      </div>
      <p className="hint" id="shareNote" role="status">{note}</p>
    </div>
  );
}
