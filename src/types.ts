export type Who = 'grand' | 'boo';

export interface ChallengeCtx {
  /** Show a subtitle and speak it. Resolves when the line ends or is cancelled. */
  say: (text: string, who?: Who) => Promise<void>;
  /** Mortimer wrong-answer reaction: buzz, shake, camera punch, angry face. */
  fail: () => void;
  mood: (m: 'happy' | 'angry' | 'neutral') => void;
  shake: () => void;
  pass: (msg: string) => void;
}
