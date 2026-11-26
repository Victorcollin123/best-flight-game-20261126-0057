// main.js — boot: build the world, wire input and sound, stage a screenshot
// scene when ?shot= is given (frozen, so the frame is the staged state), and
// otherwise run the fixed-step loop and draw every animation frame.

import { FIELD, BEST_KEY, STEP, WORLD } from './config.js';
import { createTerrain } from './terrain.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  newState,
  startFlight,
  step,
} from './state.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || WORLD.seed) || WORLD.seed;
const shotName = params.get('shot') || '';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const renderer = createRenderer(canvas, terrain);
const input = createInput(canvas);
const audio = createAudio();
const state = newState();
try {
  state.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
} catch (error) {
  state.best = 0;
}

let frozen = false;
if (shotName) {
  frozen = stageShot(shotName, state, terrain);
  state.elapsed = 24;
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(state.best));
  } catch (error) {
    // Private mode or no storage: the best score simply does not persist.
  }
}

function frame() {
  if (!frozen) {
    if (input.consume('start')) {
      audio.unlock();
      if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) {
        startFlight(state);
      }
    }
    if (input.consume('pause')) {
      if (state.screen === SCREEN_PLAY) state.screen = SCREEN_PAUSED;
      else if (state.screen === SCREEN_PAUSED) state.screen = SCREEN_PLAY;
    }
    if (input.consume('restart')) {
      if (state.screen === SCREEN_OVER || state.screen === SCREEN_WIN || state.screen === SCREEN_PAUSED) {
        startFlight(state);
      }
    }
    if (input.consume('mute')) {
      state.muted = !state.muted;
      audio.setMuted(state.muted);
    }
    const events = state.events;
    state.events = [];
    step(state, input.read(), terrain);
    for (const event of events) {
      if (event === 'ring') audio.ring();
      if (event === 'land') audio.land();
      if (event === 'crash') audio.crash();
    }
    if ((state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) && state.score > state.best) {
      state.best = state.score;
      saveBest();
    }
    audio.update(state.plane.throttle, state.plane.speed);
    const screenName =
      state.screen === SCREEN_PLAY ? 'flying' : state.screen === SCREEN_TITLE ? 'title screen' : state.screen;
    const line = `Kestrel Ridge Run, ${screenName}. Score ${state.score}, rings ${state.ringsHit} of 8, ${Math.ceil(state.timeLeft)} seconds left.`;
    if (status.textContent !== line) status.textContent = line;
  }
  renderer.draw(state);
  if (!frozen) window.requestAnimationFrame(frame);
}

renderer.draw(state);
if (frozen) {
  status.textContent = 'Kestrel Ridge Run screenshot scene.';
} else {
  window.requestAnimationFrame(frame);
}
