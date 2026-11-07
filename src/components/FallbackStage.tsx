import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Who } from '../types';

// Used only when WebGL is unavailable: two emoji ghosts that "talk" by scaling.
export const FallbackStage = forwardRef<{ mouth: (w: Who, v: number) => void }, { progress: number }>(
  function FallbackStage({ progress }, ref) {
    const g = useRef<HTMLDivElement>(null);
    const b = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ({
      mouth: (who, v) => {
        const el = who === 'grand' ? g.current : b.current;
        if (el) el.style.transform = `scale(${1 + v * 0.12})`;
      },
    }));
    return (
      <div className="fallback">
        <div ref={b} className="fb-ghost fb-boo" style={{ opacity: 0.2 + 0.8 * progress, filter: `drop-shadow(0 0 ${progress * 24}px #ff9ac4)` }}>👻<small>Boo</small></div>
        <div ref={g} className="fb-ghost fb-grand">🧓👻<small>Mortimer</small></div>
      </div>
    );
  },
);
