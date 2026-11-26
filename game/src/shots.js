// shots.js — deterministic screenshot presets, read from ?shot= and ?seed=.
// Every preset is a real state of the game, reached by setting the same fields
// the game itself sets, or by flying the real flight model with an autopilot —
// never a picture drawn for the screenshot alone.

import { RINGS, STEP, WORLD } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, startFlight, step } from './state.js';
import { valleyCentre } from './terrain.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer toward the next ring (or the runway once the rings are done). */
function autopilot(state, terrain) {
  const p = state.plane;
  const ring = RINGS[state.nextRing];
  let target;
  let cruise = 0.72;
  if (ring) {
    const dist = Math.hypot(ring.x - p.x, ring.z - p.z);
    if (dist > 350) {
      // Far out, follow the valley centreline instead of cutting the bends.
      target = { x: valleyCentre(p.z + 300), y: Math.max(ring.y, p.y - 10), z: p.z + 300 };
    } else {
      target = ring;
    }
  } else if (p.z < WORLD.landing.z - 250) {
    // Final approach: hold 45 m until the threshold, low and slow.
    target = { x: WORLD.landing.x, y: 45, z: WORLD.landing.z - 250 };
    cruise = 0.55;
  } else {
    // Short final: aim for the numbers so the wheels touch.
    target = { x: WORLD.landing.x, y: 0, z: WORLD.landing.z };
    cruise = 0.5;
  }
  const desiredHeading = Math.atan2(target.x - p.x, target.z - p.z);
  const headingError = wrapAngle(desiredHeading - p.heading);
  const desiredRoll = Math.max(-0.6, Math.min(0.6, -headingError * 1.5));
  const roll = Math.max(-1, Math.min(1, (desiredRoll - p.roll) * 2.5));
  const dist = Math.max(60, Math.hypot(target.x - p.x, target.z - p.z));
  const desiredPitch = Math.max(-0.35, Math.min(0.4, Math.atan2(target.y + 4 - p.y, dist)));
  let pitch = Math.max(-1, Math.min(1, (desiredPitch - p.pitch) * 2.5));
  const ground = terrain.groundAt(p.x, p.z);
  // Pull up when the ground gets close — except over the landing strip,
  // where the touchdown logic takes over.
  const overStrip =
    Math.abs(p.x - WORLD.landing.x) < WORLD.landing.width / 2 + 40 &&
    Math.abs(p.z - WORLD.landing.z) < WORLD.landing.length / 2 + 40;
  if (p.y < ground + 26 && !overStrip) pitch = 1;
  return {
    pitch,
    roll,
    throttleUp: p.throttle < cruise,
    throttleDown: p.throttle > cruise + 0.06,
  };
}

function flyFor(state, terrain, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.screen !== SCREEN_PLAY) break;
    step(state, autopilot(state, terrain), terrain);
  }
}

/** The cover: mid-flight, threading the second ring over the river valley. */
function applyFlightShot(state, terrain) {
  startFlight(state);
  state.plane.throttle = 0.72;
  flyFor(state, terrain, 24);
  state.timeLeft = 148;
}

/** Low over the river, the next ring glowing ahead and the ridges closing in. */
function applyValleyShot(state, terrain) {
  startFlight(state);
  state.plane.throttle = 0.72;
  flyFor(state, terrain, 44);
  state.timeLeft = 128;
}

/** Final approach: gear down over the threshold, the strip lit below. */
function applyRunwayShot(state, terrain) {
  startFlight(state);
  state.nextRing = RINGS.length;
  state.ringsHit = RINGS.length;
  state.score = 1150;
  state.timeLeft = 42;
  state.fuel = 61;
  state.plane = {
    x: WORLD.landing.x + 36,
    y: 88,
    z: WORLD.landing.z - 760,
    heading: 0.02,
    pitch: -0.06,
    roll: 0.04,
    speed: 56,
    throttle: 0.55,
  };
  state.camRoll = 0.04;
  state.camPitch = -0.06;
  flyFor(state, terrain, 5);
}

/** The win: course complete, the Kestrel parked on the strip at golden hour. */
function applyTitleShot(state, terrain) {
  startFlight(state);
  state.nextRing = RINGS.length;
  state.ringsHit = RINGS.length;
  state.score = 1450;
  state.timeLeft = 38;
  state.fuel = 100;
  state.best = 0;
  state.plane = {
    x: WORLD.landing.x,
    y: terrain.groundAt(WORLD.landing.x, WORLD.landing.z + 40) + 1.6,
    z: WORLD.landing.z + 40,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
  };
  state.camRoll = 0;
  state.camPitch = 0;
  state.screen = SCREEN_WIN;
  state.messages = [];
}

/** The title screen: the Kestrel on the strip, the valley opening ahead. */
function applyTitleScreenShot(state) {
  state.screen = SCREEN_TITLE;
  state.messages = [];
}

const SHOTS = {
  flight: applyFlightShot,
  valley: applyValleyShot,
  runway: applyRunwayShot,
  title: applyTitleScreenShot,
  win: applyTitleShot,
};

/** Set `state` to the named scene and return whether the frame should freeze. */
export function stageShot(name, state, terrain) {
  const apply = SHOTS[name] || SHOTS.flight;
  apply(state, terrain);
  return true;
}
