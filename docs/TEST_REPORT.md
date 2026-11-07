# Test report

Environment: headless Chromium 131 (Playwright 1.49.1) with SwiftShader software WebGL, loading `dist/index.html` over `file://`. Script: `scripts/playthrough.mjs`. Unit tests: `npm test` (vitest, 14 tests, all passing). Build: `dist/index.html` 629 KB, within the 1.5 MB CI budget.

| Run | Setup | Result |
| --- | --- | --- |
| desktop | 1280x760, AI endpoint blocked (scripted fallback) | All six trials, finale, results card, share and replay pass, 0 console errors or warnings |
| mobile | 390x780 @2x, touch | Same, 0 errors |
| nowebgl | WebGL forced off | Fallback stage used, fully playable, 0 errors |
| keyboard | Keyboard only, `prefers-reduced-motion` emulated | Reduced motion applied, runaway checkbox does not move, full run by keys, 0 errors |
| desktop `PLAY_AI=mock` | Endpoint returns canned lines | Canned lines reach the subtitles, verdict shown, confession sent only for its reaction, 0 errors |
| desktop `PLAY_AI=off` | AI toggle off | Zero AI requests, 0 errors |

Checks performed in every run:

- 3D canvas initialises (`#scene[data-ready]`), except in nowebgl where the fallback is expected
- Challenge order starts with the runaway checkbox, ends with the confession, and uses all six trials once
- Wrong answers trigger the angry reaction; correct answers advance
- Breathe, heartbeat and confession trials complete
- Finale, Humanity Rating card, share button and "Play again" reset
- Mute toggles `localStorage.saveBooMuted` and `aria-pressed`

The playthrough writes its screenshots to the gitignored `.playthrough-shots/`. Six are committed in `docs/screenshots/` (intro, trial, fail reaction, finale, results card, mobile) and used by the README.

## Limitations

- Headless Chromium cannot play audio, so voice quality, pitch and voice selection were not heard. The speech path falls back to timer-driven mouths and readable subtitle delays. Please listen on a real device.
- Emoji glyphs do not render in screenshots because the headless host has no emoji font. They render in normal browsers.
- The live AI endpoint is not called in tests (blocked or mocked) so results are deterministic. Real model output was not exercised in CI.
