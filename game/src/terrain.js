// terrain.js — the valley the course flies through: a winding river valley with
// ridges on both sides, flat meadows with a runway at each end, and pine trees
// scattered on the lower slopes. All heights are deterministic from the seed.

import { WORLD } from './config.js';
import { makeNoise, mulberry32 } from './random.js';

/** The valley centre wanders east and west as it runs north. */
export function valleyCentre(z) {
  return 90 * Math.sin(z * 0.00045) + 40 * Math.sin(z * 0.0011 + 1.7);
}

/** The river follows the valley floor, a little east of its centre. */
export function riverX(z) {
  return valleyCentre(z) + 60 * Math.sin(z * 0.0009 + 0.6) + 26;
}

export function createTerrain(seed) {
  const noise = makeNoise(seed);
  const fine = makeNoise(seed + 101);

  function ridgeHeight(x, z) {
    const centre = valleyCentre(z);
    const across = Math.abs(x - centre);
    const valley = Math.min(1, across / WORLD.valleyHalfWidth);
    const rise = valley * valley * WORLD.ridgeHeight;
    const rough = noise(x * 0.004, z * 0.004) * 46 + fine(x * 0.02, z * 0.02) * 7;
    return rise + rough * (0.25 + valley);
  }

  function heightAt(x, z) {
    // Both strips are flattened so takeoffs and landings are fair: fully flat
    // across the strip plus a margin, blending back to the valley over 140 m.
    let meadow = 0;
    for (const strip of [WORLD.takeoff, WORLD.landing]) {
      const dx = Math.abs(x - strip.x) - (strip.width / 2 + 60);
      // The landing strip's meadow runs further south, so the final approach
      // is over flat ground instead of rising terrain.
      const south = strip.length / 2 + 60 + (strip.approach || 0);
      const dz = Math.max(z - strip.z - (strip.length / 2 + 60), strip.z - south - z);
      const outside = Math.max(dx, dz);
      meadow = Math.max(meadow, Math.max(0, Math.min(1, 1 - outside / 140)));
    }
    const flat = 6;
    const h = ridgeHeight(x, z);
    return h * (1 - meadow) + flat * meadow;
  }

  function riverDepth(x, z) {
    const rx = riverX(z);
    const d = Math.abs(x - rx);
    if (d > 26) return 0;
    return (1 - d / 26) * 7;
  }

  /** Ground height under a point, with the river carved into the valley floor. */
  function groundAt(x, z) {
    return heightAt(x, z) - riverDepth(x, z);
  }

  /** Trees stand on the lower slopes, clear of the river and the runway. */
  const trees = [];
  const rand = mulberry32(seed + 77);
  for (let i = 0; i < 420; i += 1) {
    const z = 60 + rand() * 4100;
    const side = rand() < 0.5 ? -1 : 1;
    const across = 70 + rand() * 260;
    const x = valleyCentre(z) + side * across;
    if (Math.abs(x - riverX(z)) < 34) continue;
    if (Math.abs(x - WORLD.takeoff.x) < 150 && Math.abs(z - WORLD.takeoff.z) < 330) continue;
    if (Math.abs(x - WORLD.landing.x) < 150 && Math.abs(z - WORLD.landing.z) < 330) continue;
    const h = groundAt(x, z);
    if (h > 190) continue;
    trees.push({ x, z, h, size: 9 + rand() * 13, shade: 0.75 + rand() * 0.25 });
  }

  /** A few clouds drift high over the valley. */
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    clouds.push({
      x: -500 + rand() * 1000,
      y: 260 + rand() * 90,
      z: 200 + rand() * 4000,
      size: 60 + rand() * 90,
      speed: 2 + rand() * 3,
    });
  }

  return { heightAt, groundAt, riverX, trees, clouds };
}
