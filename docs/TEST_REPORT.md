# Test report

Environment: headless Chromium 131 (Playwright 1.49) with SwiftShader software WebGL, loading `dist/index.html` over `file://`. Script: `scripts/playthrough.mjs` (`desktop`, `mobile`, `nowebgl` modes).

| Mode | Viewport | Result |
| --- | --- | --- |
| desktop | 1280x760 | All six challenges plus finale and replay pass, 0 console errors or warnings |
| mobile | 390x780 @2x, touch | Same, 0 console errors or warnings |
| nowebgl | 1280x760, WebGL forced off | Fallback stage used, game fully playable, 0 errors |

Checks performed in every run:

- 3D canvas initialises (`#scene[data-ready]`), except in nowebgl where the fallback is expected
- Runaway checkbox dodges 6 times, wrong grid answer triggers the angry reaction and camera punch, correct answers advance
- Breathe (hold 2.8 s twice), heartbeat (5 steady taps) and confession (voiced analysis sequence) complete
- Finale burst, Boo speaks, "Play again" resets the game
- Mute button toggles `localStorage.saveBooMuted` and `aria-pressed`
- Subtitles are visible on every screenshot

Screenshots are in `docs/screenshots/` (`desktop-*`, `mobile-*`, `nowebgl-*`).

## Limitations

- Headless Chromium cannot play audio, so voice quality, pitch and voice selection were not heard. The speech path was exercised and falls back to timer-driven mouths and readable subtitle delays when no voice produces events. Please listen on a real device.
- Emoji glyphs (speaker icon, tile characters) do not render in screenshots because the headless host has no emoji font. They render in normal browsers.
- Mute for real audio output was verified by code path (`sfx` master gain and `voice.cancel`), not by listening.
- The in-session Playwright tool blocks `file://`, so a separate Playwright install was used for the playthrough.
