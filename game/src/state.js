// state.js — the game state machine and the arcade flight model: throttle sets
// speed, pitch trades speed for height, banking turns the plane, and the valley
// floor, the rings and the runway decide what counts.

import { GAME, PLANE, RINGS, STEP, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_LANDED = 'landed';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function startPose() {
  return {
    x: WORLD.takeoff.x,
    y: 14,
    z: WORLD.takeoff.z - WORLD.takeoff.length / 2 + 60,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
  };
}

export function newState() {
  return {
    screen: SCREEN_TITLE,
    plane: startPose(),
    nextRing: 0,
    ringsHit: 0,
    score: 0,
    fuel: GAME.fuelMax,
    timeLeft: GAME.timeLimit,
    lives: GAME.lives,
    best: 0,
    messages: [],
    crashTimer: 0,
    landTimer: 0,
    elapsed: 0,
    muted: false,
    camRoll: 0,
    camPitch: 0,
    won: false,
    events: [],
  };
}

function say(state, text, seconds) {
  state.messages.push({ text, until: state.elapsed + (seconds || 2.2) });
  if (state.messages.length > 3) state.messages.shift();
}

/** True when the plane is low over the named strip. */
function onStrip(state, terrain, strip) {
  const p = state.plane;
  return (
    Math.abs(p.x - strip.x) < strip.width / 2 + 6 &&
    Math.abs(p.z - strip.z) < strip.length / 2 + 6 &&
    p.y < terrain.groundAt(p.x, p.z) + 6
  );
}

function respawn(state) {
  const ring = RINGS[Math.max(0, state.nextRing - 1)];
  const start = state.nextRing === 0 ? startPose() : null;
  if (start) {
    state.plane = start;
  } else {
    state.plane = {
      x: ring.x,
      y: ring.y + 6,
      z: ring.z - 160,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: PLANE.cruiseSpeed,
      throttle: 0.7,
    };
  }
  state.plane.speed = Math.max(state.plane.speed, PLANE.cruiseSpeed);
  state.camRoll = 0;
  state.camPitch = 0;
}

export function startFlight(state) {
  state.plane = startPose();
  state.nextRing = 0;
  state.ringsHit = 0;
  state.score = 0;
  state.fuel = GAME.fuelMax;
  state.timeLeft = GAME.timeLimit;
  state.lives = GAME.lives;
  state.messages = [];
  state.won = false;
  state.elapsed = 0;
  state.screen = SCREEN_PLAY;
  say(state, 'Follow the valley — thread the amber rings', 3);
}

/** One fixed step of the flight model. `input` is { pitch, roll, throttleUp, throttleDown }. */
export function stepFlight(state, input, terrain, dt) {
  const p = state.plane;
  state.elapsed += dt;
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.screen = SCREEN_OVER;
    state.events.push('time');
    return;
  }

  // Throttle: Shift/plus up, Control/minus down; empty tanks force a glide.
  if (state.fuel > 0) {
    if (input.throttleUp) p.throttle = Math.min(1, p.throttle + dt * 0.7);
    if (input.throttleDown) p.throttle = Math.max(0, p.throttle - dt * 0.7);
  } else {
    p.throttle = 0;
  }
  const targetSpeed = p.throttle * PLANE.maxSpeed;
  const accel = targetSpeed > p.speed ? PLANE.accel : PLANE.accel * 0.55;
  p.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - p.speed));
  p.speed -= p.speed * PLANE.drag * 0.05 * dt;
  if (p.speed < 0) p.speed = 0;

  // Pitch and roll, with a gentle auto-level so the plane never holds a bank alone.
  p.pitch += input.pitch * PLANE.pitchRate * dt;
  p.pitch = Math.max(-0.45, Math.min(0.55, p.pitch));
  if (input.pitch === 0) p.pitch *= 1 - 0.22 * dt;
  p.roll += input.roll * PLANE.rollRate * dt;
  p.roll = Math.max(-1.1, Math.min(1.1, p.roll));
  if (input.roll === 0) p.roll *= 1 - 0.9 * dt;
  // Banking turns the plane: roll > 0 is a left bank (right wing up), so heading falls.
  p.heading -= p.roll * PLANE.turnRate * dt;

  // Fly forward along the nose; too slow and she sinks, gently.
  const cp = Math.cos(p.pitch);
  const vx = Math.sin(p.heading) * cp * p.speed;
  const vz = Math.cos(p.heading) * cp * p.speed;
  let vy = Math.sin(p.pitch) * p.speed;
  if (p.speed < PLANE.stallSpeed) vy -= PLANE.sinkRate * (1 - p.speed / PLANE.stallSpeed);
  const prevZ = p.z;
  p.x += vx * dt;
  p.y += vy * dt;
  p.z += vz * dt;
  state.fuel = Math.max(0, state.fuel - GAME.fuelBurn * p.throttle * dt);
  if (state.fuel <= 0 && !state.fuelWarned) {
    state.fuelWarned = true;
    say(state, 'FUEL EMPTY — glide to the runway', 3);
    state.events.push('fuel');
  }

  // Camera follows the bank a beat late, so the horizon tilts smoothly.
  state.camRoll += (p.roll - state.camRoll) * Math.min(1, dt * 5);
  state.camPitch += (p.pitch - state.camPitch) * Math.min(1, dt * 5);

  // Rings: crossing the ring's plane inside its circle scores.
  const ring = RINGS[state.nextRing];
  if (ring) {
    if (prevZ < ring.z && p.z >= ring.z) {
      const dx = p.x - ring.x;
      const dy = p.y - ring.y;
      if (Math.hypot(dx, dy) < ring.r) {
        state.ringsHit += 1;
        state.score += GAME.ringPoints;
        say(state, `RING ${state.nextRing + 1} OF ${RINGS.length}  +${GAME.ringPoints}`, 2);
        state.events.push('ring');
      } else {
        say(state, `MISSED RING ${state.nextRing + 1}`, 2);
      }
      state.nextRing += 1;
    }
  }

  // The ground: a gentle touchdown on a strip is a landing, anything else a crash.
  const ground = terrain.groundAt(p.x, p.z);
  if (p.y <= ground + 1.6) {
    const gentle = Math.abs(p.pitch) < 0.18 && p.speed < 58 && vy > -9;
    const onTakeoff = onStrip(state, terrain, WORLD.takeoff);
    const onLanding = onStrip(state, terrain, WORLD.landing);
    if ((onTakeoff || onLanding) && gentle) {
      p.y = ground + 1.6;
      state.score += GAME.landingPoints;
      state.fuel = GAME.fuelMax;
      state.events.push('land');
      if (onLanding && state.nextRing >= RINGS.length) {
        state.won = true;
        state.score += GAME.winBonus;
        state.screen = SCREEN_WIN;
        state.events.push('win');
        say(state, `COURSE COMPLETE  +${GAME.landingPoints + GAME.winBonus}`, 2);
      } else if (onLanding) {
        // Down early on the far strip: refuel, then back to the last ring.
        state.screen = SCREEN_LANDED;
        state.landTimer = 2.2;
        state.landedEarly = true;
        say(state, `LANDED EARLY  +${GAME.landingPoints} — back to the course`, 2);
      } else {
        state.screen = SCREEN_LANDED;
        state.landTimer = 2.2;
        state.landedEarly = false;
        say(state, `LANDED  +${GAME.landingPoints} — tanks full`, 2);
      }
    } else {
      state.screen = SCREEN_CRASHED;
      state.crashTimer = 1.6;
      state.lives -= 1;
      state.events.push('crash');
    }
    return;
  }

  // Too low over the valley floor earns a warning before the ground does.
  if (p.y < ground + 14 && !state.lowWarned) {
    state.lowWarned = true;
    say(state, 'PULL UP', 1.4);
  } else if (p.y > ground + 26) {
    state.lowWarned = false;
  }

  // Keep the plane inside the valley: a soft push back, never a wall.
  if (Math.abs(p.x) > 640) {
    p.heading += (p.x > 0 ? -1 : 1) * 0.25 * dt;
  }
  if (p.z > WORLD.courseLength + 260) {
    p.heading = Math.PI - p.heading * 0.2;
  }
  if (p.y > 420) p.pitch = Math.min(p.pitch, 0);
}

/** Advance the state one frame: timers, screens and the flight model. */
export function step(state, input, terrain) {
  state.messages = state.messages.filter((m) => m.until > state.elapsed);
  if (state.screen === SCREEN_PLAY) {
    stepFlight(state, input, terrain, STEP);
  } else if (state.screen === SCREEN_CRASHED) {
    state.crashTimer -= STEP;
    state.elapsed += STEP;
    if (state.crashTimer <= 0) {
      if (state.lives <= 0) {
        state.screen = SCREEN_OVER;
      } else {
        respawn(state);
        state.screen = SCREEN_PLAY;
        say(state, `Lives left: ${state.lives}`, 2);
      }
    }
  } else if (state.screen === SCREEN_LANDED) {
    state.landTimer -= STEP;
    state.elapsed += STEP;
    if (state.landTimer <= 0) {
      if (state.landedEarly) {
        respawn(state);
        say(state, 'Back on course', 2);
      } else {
        // Rolling again down the strip, pointed at the valley.
        state.plane.heading = 0;
        state.plane.pitch = 0;
        state.plane.roll = 0;
        state.plane.throttle = 0.7;
      }
      state.screen = SCREEN_PLAY;
    }
  }
}
