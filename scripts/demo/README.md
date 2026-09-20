# Demo videos

Narrated screen recordings of a feature, produced from the real app running against mocked data. Nothing here touches an exchange, a key or the database, and no rendered video is committed: the output lands in the gitignored `.out/`, and finished files belong wherever you keep media.

## Running it

```bash
brew install uv espeak-ng ffmpeg
scripts/demo/setup-tts.sh
bun run demo:video bybit-portfolios
```

The first run renders the narration with Kokoro (downloading its ~330 MB model once), records the scene, and writes `scripts/demo/.out/bybit-portfolios.mp4` plus a matching `.srt`. Later runs reuse the narration already rendered under `.work/<video>/audio` unless you pass `--narrate`.

Useful flags:

- `--narrate` re-renders the narration, which is what a wording or voice change needs.
- `--encode-only` re-encodes from the frames of the last recording, for changes to pacing, subtitles or audio mixing.
- `--out=path.mp4` writes somewhere else.
- `KOKORO_VOICE=am_michael` picks another voice, `KOKORO_SPEED=1.1` speeds the delivery up without a pitch shift, and `DEMO_PYTHON=/path/to/python` points at a Kokoro environment somewhere other than `~/.cache/crypto-tools/kokoro-venv`.

A voice or wording change means re-recording, not just re-encoding: the scene waits on the narration clips, so every scene boundary moves when their durations move.

## How it fits together

- `vite.config.ts` serves the real frontend from the repo root in mocked mode on port 3100, with one change: a `resolveId` plugin swaps `src/views/mocks/portfolio.ts` for the video's own `mock.ts`. Port 3000 is left alone, so a normal `bun run dev` can keep running.
- `studio.ts` drives headless Chrome through playwright-core and records the frames. It injects a synthetic cursor (headless Chrome draws none), click ripples, a spotlight that dims everything but one element, and full-screen title cards, then captures a CDP screencast. `speak()` starts a narration clip and resolves when it ends, so a scene reads as a timeline: start a line, perform the actions it describes, `await quiet()` before the next one.
- `encode.ts` turns the frames into an MP4. Frame timestamps become per-frame durations, so the video keeps the real timing of the recording; stretches with no narration are sped up to at most 2.5x; the narration clips are mixed in at the times the scene recorded, quiet click sounds are added at each cursor press, and the captions become both a sidecar `.srt` and a soft subtitle track.
- `narrate.ts` and `render-narration.py` render `narration.json` with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0, local, CPU), trim the silence, and record each clip's duration.
- `run.ts` starts the server, runs the scene, stops the server, and encodes.

## Adding a video

Create `videos/<name>/` with three files:

- `narration.json` — one entry per line of narration: `id`, `say` (what the voice reads) and `caption` (what the subtitles show). Keep them separate: the voice needs "Bye bit", "U S D T" and "V V V" to come out right, while the subtitles should read "Bybit", "USDT" and "VVV".
- `mock.ts` — optional, and only for a page whose normal mock is not a good story. It replaces `src/views/mocks/portfolio.ts`, so it must export the same `portfolioRoutes` shape. `videos/bybit-portfolios/mock.ts` is worth copying: it starts from an empty account, and it drives the **real** `planPortfolio` from `src/server/services/portfolio/planner.ts`, so every preview in the video is the planner's own output rather than something made up for the camera. It also exposes `window.__video` so a scene can move prices and advance the clock mid-recording.
- `scene.ts` — the script, exporting `default async function scene(studio)`.

Then `bun run demo:video <name>`.

## Writing a scene

`scene.ts` reads as narration interleaved with actions:

```ts
studio.speak('preview')
await studio.click(cardButton('Rebalance'), { settle: 1200 })
await studio.spot(dialog.locator('table'), 6)
await studio.quiet()
await studio.spot(null)
```

What the studio offers: `speak` / `quiet` / `pause`, `click` / `hover` / `moveTo` / `type` / `replace`, `spot` / `spotColumn` for highlights, `card` for a full-screen title, `scrollTo` and `reveal` for smooth scrolling, and `startCapture` / `markStart` to begin recording once the opening card is up.

Things worth knowing:

- Prefer role and `data-slot` locators over positions. `[data-slot="dialog-footer"] button` separates a dialog's real button from the `X` that shares its accessible name.
- Radix autofocuses the first field of a dialog, which leaves a focus ring in the shot. `blurFocus()` in the Bybit scene clears it.
- Wait on text the app renders (`5 of 5 orders settled`) rather than on a fixed sleep, so a slow machine does not desynchronise the take.
- Keep spoken numbers out of the narration where you can. Every figure named in the voice track is one more thing to re-record when the fixture changes.

## Reviewing a take without watching it end to end

```bash
ffmpeg -i scripts/demo/.out/<name>.mp4 -vf "fps=1/6,scale=640:360,tile=4x4" -frames:v 2 /tmp/sheet%d.png
```

A contact sheet catches the common faults — a dialog that never opened, a spotlight on the wrong row, a cursor parked over the text. The per-clip timings printed during a run show where the silences are, which is what the fast-forward is there to absorb.

## Cost and upkeep

A narrated video ages badly: the narration hard-codes figures from the fixture, so a change to the flow means rewriting the script and re-recording. Screenshots and a deployed mocked build (`VITE_MOCK_DATA=true bun run build`) stay current for free and are the better default; keep videos for releases worth announcing.
