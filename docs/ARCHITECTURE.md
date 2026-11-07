# Architecture

Save Boo is a static Vite + React + TypeScript app. `vite-plugin-singlefile` inlines everything into one `dist/index.html`, so it runs from GitHub Pages or straight from disk.

## Layout

```
src/App.tsx                     state machine, HUD, subtitles, glue between scene, voice and challenges
src/types.ts                    ChallengeCtx, the API every challenge receives
src/challenges/Challenges.tsx   the six challenges, OPENER / MIDDLE / CLOSER, makeRun()
src/components/                 Results card, Settings panel, Confetti, no-WebGL FallbackStage
src/game/scene3d.ts             Three.js scene (ghosts, fog, camera moves, finale burst)
src/game/voice.ts               SpeechSynthesis, subtitles, mouth callback
src/game/sfx.ts                 WebAudio synthesized effects
src/game/lines.ts               scripted line pools (the always-available fallback)
src/game/ai.ts                  live AI Mortimer with sanitizing, timeout and fallback
src/game/settings.ts            persisted settings (localStorage) and haptics
scripts/playthrough.mjs         Playwright end to end playthrough
```

## State machine

`App.tsx` keeps one `phase`:

```
intro -> greeting -> trial -> passed -> trial -> ... -> finale -> done -> (again) intro
```

- `intro`: Begin button, voice choice, settings. Audio unlocks on this user gesture.
- `greeting`: Mortimer speaks, Space or Escape skips.
- `trial`: renders the current challenge. The run comes from `makeRun()`: runaway checkbox first, the confession last, the four middle trials shuffled.
- `passed`: a pass message and a Next button.
- `finale` / `done`: Boo wakes, then the results card shows the humanity rating, an AI verdict when available, and a share button.

## Challenge API (ChallengeCtx)

Each challenge receives a `ChallengeCtx` (see `src/types.ts`):

| Member | Purpose |
| --- | --- |
| `say(text, who?)` | Subtitle plus speech, resolves when the line ends |
| `fail(specific?)` | Wrong answer: buzz, shake, haptics, mistake count, escalating reaction |
| `pass(msg)` | Trial solved, moves to `passed` |
| `mood`, `shake` | Drive Boo and Mortimer expressions and the camera |
| `line(key)` | A live AI line when ready, else a scripted pool line |
| `react(text)` | AI reaction to the typed confession (respects opt-outs) |
| `n`, `total`, `fails()` | Position in the run and mistakes so far, for gentle difficulty |
| `reduced` | Reduced motion is on: no shake, no moving targets |

## Adding a challenge

1. Write a component in `src/challenges/Challenges.tsx` that takes the same props as the others, has a `data-challenge="yourid"` root, and calls `ctx.pass(...)` or `ctx.fail()`.
2. Make it keyboard operable (focusable controls, Enter or Space) and honor `ctx.reduced`.
3. Add `{ id, hint, Component }` to `MIDDLE`, plus the matching hint pool key in `src/game/lines.ts` and in the `ChallengeDef` type.
4. Add a branch in `scripts/playthrough.mjs` for pointer and keyboard modes.
5. Run `npm test`, `npm run build` and the playthroughs.

## AI Mortimer

`ai.ts` prefetches one line ahead, keeps at most one request in flight, caps a run at 40 calls, and sanitizes every reply. Any failure falls back to `lines.ts`, so the game never depends on the network. See the README for privacy and bring-your-own-endpoint details.
