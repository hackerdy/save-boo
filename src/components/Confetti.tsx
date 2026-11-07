import { useMemo } from 'react';

const EMOJI = ['🎃', '👻', '🦇', '✨', '🍬', '💖'];

export function Confetti() {
  const items = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    e: EMOJI[Math.floor(Math.random() * EMOJI.length)],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    key: i,
  })), []);
  return (
    <>
      {items.map((c) => (
        <div key={c.key} className="confetti" style={{ left: c.left + 'vw', animationDelay: c.delay + 's' }}>{c.e}</div>
      ))}
    </>
  );
}
