# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Victorcollin123/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Victorcollin123/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Kestrel Ridge Run — an original 3D chase-view flight game. Fly a bush plane down a golden-hour river valley, thread all eight amber rings, mind your fuel and your altitude over the ridges, and put her down gently on the far runway. A custom software 3D renderer draws the valley, the river, the pines and the rings; the instruments are lit — altitude, speed and heading on the HUD, with an attitude indicator, throttle and fuel gauges and speed/altitude tapes. Three lives, a 180-second clock, and a score to beat. Playable offline in a desktop browser from static files — no network request, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Arrow keys or WASD fly (up climbs, left banks left), Shift throttles up, Ctrl throttles down, P pauses, M mutes, R restarts. Click or press Enter to take off.

## How it plays

- Take off from the valley runway and follow the amber rings north — each ring is worth 100 points.
- Banking turns the plane; too slow and she sinks, too low and the ridges bite. Pull up when the warning shows.
- Land on the far runway for 250 points and a full tank; finish all eight rings and land to complete the course.
- Fuel burns with the throttle, so a flat-out run will not make the far meadow. Three crashes end the flight; the clock runs out at 3:00.

## Files

- `game/` — the playable game as static files (`index.html`, `src/`).
- `game/src/config.js` — tuning, palette, the ring course; `terrain.js` — the valley, river, runway and pines; `camera.js` — chase camera and projection; `model.js` — the Kestrel's polygon model; `state.js` — the flight model and screens; `render.js` — sky, valley, rings, plane and instruments; `input.js` — keyboard + mouse; `audio.js` — synthesized engine, wind and chimes; `shots.js` — screenshot presets; `main.js` — boot.
- `screenshots/` — flight, valley, runway and title screens, real renders of the game.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.
