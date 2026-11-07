export type Who = 'grand' | 'boo';

export interface ChallengeCtx {
  /** Show a subtitle and speak it. Resolves when the line ends or is cancelled. */
  say: (text: string, who?: Who) => Promise<void>;
  /** Wrong answer: buzz, shake, haptics, counts a mistake and says an escalating reaction
   *  (the specific line is used for early failures). */
  fail: (specific?: string) => void;
  mood: (m: 'happy' | 'angry' | 'neutral') => void;
  shake: () => void;
  pass: (msg: string) => void;
  /** 1-based position of this challenge in the current run, and the run length. */
  n: number;
  total: number;
  /** Mistakes made on this challenge so far (drives the gentle difficulty curve). */
  fails: () => number;
  /** True when reduced motion is on: no screen shake, no runaway movement. */
  reduced: boolean;
}
