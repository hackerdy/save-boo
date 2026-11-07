// Mortimer's script. Every spoken line that is not tied to user input comes from a pool here,
// picked at random without immediate repeats, so each run sounds a little different.
// Keep all pools in this module: an AI layer can wrap pickLine() to generate fresh lines
// and fall back to these pools when offline.

export type PoolKey =
  | 'greeting' | 'idle' | 'assistOffer' | 'assistTaken'
  | 'failMild' | 'failSnark' | 'failKind'
  | 'passGeneric' | 'finale1' | 'finale2' | 'finale3'
  | 'intro_runaway' | 'intro_grid' | 'intro_text' | 'intro_breathe' | 'intro_heart' | 'intro_secret'
  | 'hint_runaway' | 'hint_grid' | 'hint_text' | 'hint_breathe' | 'hint_heart' | 'hint_secret'
  | 'nervous' | 'giveUp' | 'gridWrong' | 'textWrong' | 'breathShort' | 'heartFast' | 'heartSlow' | 'heartMessy'
  | 'secretShort' | 'secretAnalyze' | 'secretReact';

export const LINES: Record<PoolKey, string[]> = {
  greeting: [
    "Greetings, mortal. Or ghost pretending to be mortal. My granddaughter Boo is fading. Prove you're human to save her. No pressure. Lots of pressure.",
    "Ah, a visitor! Good. My granddaughter Boo is fading, and the Ghost Council says only a verified human can help. Sorry about the paperwork.",
    "Welcome, welcome. Please ignore the cobwebs. Boo is fading and you look suspiciously alive. Let us test that, shall we?",
  ],
  idle: [
    "Still there? Humans are famous for dawdling. Here is a hint.",
    "Take your time. Boo only has a few centuries left. Hint incoming.",
    "I can hear you thinking. It sounds like dial-up. A hint, then.",
  ],
  assistOffer: [
    "You seem stuck. I am a ghost of mercy. I can wave you through, no shame. Okay, a little shame.",
    "This is getting painful, for both of us. Press the mercy button if you like. I will pretend I did not see.",
  ],
  assistTaken: [
    "Fine, I am waving you through. Do not tell the council.",
    "Mercy granted. Your humanity rating will quietly weep, but onward!",
  ],
  failMild: [
    "WRONG. Maybe you ARE a ghost. Try again, spooky.",
    "Nope. Very ghostly of you.",
    "Hmm. Not quite. Again.",
    "Incorrect. Boo flickered. Just a little.",
  ],
  failSnark: [
    "Again?! I have seen toasters do better. Haunted toasters, but still.",
    "That was the third mistake. I am keeping a list. It is a long list.",
    "Are you doing this on purpose? It feels personal.",
  ],
  failKind: [
    "Deep breath. Everyone struggles sometimes. Even the living. Especially the living.",
    "You are doing fine. Probably. Let me make it a bit easier.",
    "Boo believes in you. She also believes in cheese, so take that as you will.",
  ],
  passGeneric: [
    "Acceptable.",
    "Correct. Boo glowed a little brighter.",
    "Not bad for a mortal.",
    "Well done. I am only slightly suspicious now.",
  ],
  finale1: [
    "You... you actually did it. Boo? BOO?!",
    "The light! The glorious light! Boo, can you hear me?!",
  ],
  finale2: [
    "Gaga! Ga-ga-ga! Hee hee hee!",
    "Ga ga! Boooo! Hee hee!",
  ],
  finale3: [
    "Boo is ALIVE! Thank you, human. Probably.",
    "She is back! I will never doubt a human again. Okay, I will, but less.",
  ],
  intro_runaway: [
    "Simply tick the box. Humans do this thousands of times a day. Easy!",
    "First, the sacred checkbox. A human ticks it without thinking. Go on.",
    "A small test. One checkbox. What could possibly go wrong?",
  ],
  intro_grid: [
    "Prove your eyes work. Pick every matching square. Vampires do not count, I do not care how much they say they identify as human.",
    "Time to squint at tiny pictures, just like a real person on the internet.",
    "Select the right squares. Choose wisely. The zombie is watching.",
  ],
  intro_text: [
    "Read the letters. If you squint like a human, they stop moving. They don't.",
    "These letters are cursed. A human reads them anyway. Out of spite.",
    "Type what you see. The wobbling is for your own good.",
  ],
  intro_breathe: [
    "Humans breathe in, and out. Do it twice. I'll be watching. Creepily.",
    "Breathing. A classic. Hold the button to inhale, let go to exhale. I do not know how it works either.",
    "Show me some lungs. In, then out. Slowly. Do not hyperventilate on my carpet.",
  ],
  intro_heart: [
    "Humans have a rhythm. Tap it out. Not too fast, that's panicking. Not too slow, that's dead. Well, I'd be fine with that.",
    "Let me hear that heartbeat. Five steady taps.",
    "Time for a pulse check. Five taps, nice and even.",
  ],
  intro_secret: [
    "Last one. Only humans feel shame. Tell me something embarrassing. Be specific.",
    "The final trial. Confess something embarrassing. The more specific, the more human.",
    "One last thing. A confession. Make it cringe. Boo's life depends on your shame.",
  ],
  hint_runaway: [
    "The box runs away. Keep trying, it gets tired. You can also press Space or Enter on it.",
    "Be persistent. The checkbox tires out after a few tries.",
  ],
  hint_grid: [
    "Only tick the squares that match the title, then press verify.",
    "Look at the title again. Everything that matches, nothing that does not.",
  ],
  hint_text: [
    "Type the wobbling letters, then press Enter.",
    "Ignore the wobble. Just read the letters.",
  ],
  hint_breathe: [
    "Hold the button until the bar fills, then let go. You can also hold Space.",
    "Do not let go too early. Wait for the bar to fill.",
  ],
  hint_heart: [
    "Tap the button five times at an even pace. Space or Enter works too.",
    "Think of a metronome. Same gap every time.",
  ],
  hint_secret: [
    "Write at least twenty characters of shame, then confess.",
    "Anything embarrassing will do. Longer than a tweet, please.",
  ],
  nervous: [
    "Hm, it seems nervous. Ghosts are like that. Are YOU nervous, ghost?",
    "It is running again. I did not program it to. Truly.",
  ],
  giveUp: [
    "Fine. The checkbox is tired. Tick it.",
    "It gave up. Impressive persistence. Tick it.",
  ],
  gridWrong: [
    "WRONG. Maybe you ARE a ghost. Try again, spooky.",
    "Not quite. Check every square again.",
  ],
  textWrong: [
    "Nope. Was it the squiggly bit? It's always the squiggly bit.",
    "Close, but no. Humans make typos, ghosts do not. Suspicious.",
  ],
  breathShort: [
    "Too short! That was a hiccup, not a breath.",
    "Too fast! Wait for the bar to fill.",
  ],
  heartFast: ["Are you a hummingbird? Slow down a little.", "That is a panic, not a pulse. Slower."],
  heartSlow: ["Is that a rock? Pick up the pace.", "A bit faster, please. I am aging here."],
  heartMessy: [
    "That rhythm is all over the place. Do you need a doctor or an exorcist?",
    "Irregular! Even gaps, please.",
  ],
  secretShort: [
    "That's not embarrassing, that's a tweet. MORE. At least 20 characters of shame.",
    "I have seen better confessions from a potato. Longer, please.",
  ],
  secretAnalyze: [
    "Hmmmm, analyzing shame levels...",
    "Consulting the council of cringe...",
  ],
  secretReact: [
    "Yes. That's the cringiest thing I've ever heard.",
    "Oh no. Oh, that is excellent. I am so sorry.",
    "Perfect. I will remember this at your funeral.",
  ],
};

const last = new Map<string, string>();

/** Random line from a pool, never the same one twice in a row. `{n}` style vars are substituted. */
export function pickLine(key: PoolKey, vars?: Record<string, string | number>): string {
  const pool = LINES[key];
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1) {
    let guard = 0;
    while (line === last.get(key) && guard++ < 8) line = pool[Math.floor(Math.random() * pool.length)];
  }
  last.set(key, line);
  if (vars) for (const k of Object.keys(vars)) line = line.split(`{${k}}`).join(String(vars[k]));
  return line;
}
