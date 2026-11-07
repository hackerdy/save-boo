# Save Boo

A Halloween game in 3D with voice overs. Baby ghost Boo has stopped moving, and the only cure is a human's touch. Grandghost Mortimer will only let you near Boo if you prove you are human, through six absurd challenges. Pass them all to revive Boo.

## Stack

- **Vite + React 18 + TypeScript** for the app shell, game flow and the six challenge components
- **Three.js** (npm, bundled) for the 3D night graveyard, procedural ghosts, fireflies, fog, moonlight and a finale light burst
- **Web Speech API** for voice overs, **WebAudio** for synthesized sound effects (no audio files, no paid APIs)
- Built to a **single `dist/index.html`**, so it works on GitHub Pages and also opens straight from disk (file://)

## Run

```
npm install
npm run dev        # dev server with hot reload
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Open `dist/index.html` directly after a build if you like, no server needed.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`. In the repo settings, set Pages source to "GitHub Actions".

## Voice overs

Mortimer speaks low and slow, Boo speaks high and fast, using the best English voice the browser offers (for example Daniel, Google UK English Male, Samantha, Zira). Voices differ per device, so the exact sound varies. Notes:

- Subtitles are always shown, with the speaker name, even when muted or when the browser has no speech support.
- Mouths animate while a line is spoken (timer driven plus word boundary accents).
- Audio starts after you press Begin (browsers require a user gesture). A Skip button cuts a line short.
- The speaker button mutes voice and sound effects together and cancels any line in progress. The choice is saved in `localStorage` (`saveBooMuted`).

## 3D notes

- Pixel ratio is capped (1.5 on small screens, 2 otherwise) and the scene is low poly.
- The camera moves per challenge, punches on a wrong answer, and Boo glows brighter with each passed trial.
- If WebGL is unavailable the game falls back to a simple emoji stage and stays fully playable.

## Project layout

```
src/App.tsx                     game flow, subtitles, HUD
src/challenges/Challenges.tsx   the six challenges
src/game/scene3d.ts             Three.js scene
src/game/voice.ts               speech synthesis
src/game/sfx.ts                 WebAudio sound effects
scripts/playthrough.mjs         headless Playwright playthrough (see docs/TEST_REPORT.md)
```

## Challenges

1. The Sacred Checkbox
2. Select all squares with a HUMAN
3. Read the cursed text
4. Prove you breathe
5. Show me your heartbeat
6. Final Challenge: Confess

## Notes

- Voices come from the browser/OS (SpeechSynthesis). Mortimer and Boo are told apart by voice name where available (Daniel/Samantha on Apple, David/Zira on Windows) and always by pitch and rate. On Linux or Android the default voice may be used for both, so the difference can be pitch only.
- `npm run typecheck` runs `tsc` in strict mode. CI (`.github/workflows/ci.yml`) typechecks, builds and runs `scripts/playthrough.mjs` in all three modes.
