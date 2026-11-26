// camera.js — a chase camera built from basis vectors: forward from the plane's
// heading and pitch, right and up from the world up, then rolled with the bank.
// Projecting a world point gives screen pixels (or null when it is behind us).

import { FIELD } from './config.js';

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Basis (forward, right, up) for a heading (rad, 0 = north), pitch and roll. */
export function makeBasis(heading, pitch, roll) {
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const forward = norm([sh * cp, sp, ch * cp]);
  const upWorld = [0, 1, 0];
  const right = norm(cross(upWorld, forward));
  // Up is forward cross right: the handedness that puts the sky above the
  // horizon (cross(right, forward) points down and flips the whole scene).
  const up = cross(forward, right);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rightRolled = [
    right[0] * cr + up[0] * sr,
    right[1] * cr + up[1] * sr,
    right[2] * cr + up[2] * sr,
  ];
  const upRolled = [
    -right[0] * sr + up[0] * cr,
    -right[1] * sr + up[1] * cr,
    -right[2] * sr + up[2] * cr,
  ];
  return { forward, right: rightRolled, up: upRolled };
}

export function makeCamera(position, heading, pitch, roll) {
  const basis = makeBasis(heading, pitch, roll);
  const focal = (FIELD.height / 2) / Math.tan((62 * Math.PI) / 360);
  return { position, ...basis, focal, cx: FIELD.width / 2, cy: FIELD.height / 2 };
}

/** Project a world point to screen space; null when behind the camera plane. */
export function project(camera, point) {
  const dx = point[0] - camera.position[0];
  const dy = point[1] - camera.position[1];
  const dz = point[2] - camera.position[2];
  const cz =
    dx * camera.forward[0] + dy * camera.forward[1] + dz * camera.forward[2];
  if (cz < 1.5) return null;
  const cx = dx * camera.right[0] + dy * camera.right[1] + dz * camera.right[2];
  const cy = dx * camera.up[0] + dy * camera.up[1] + dz * camera.up[2];
  const scale = camera.focal / cz;
  return { x: camera.cx + cx * scale, y: camera.cy - cy * scale, z: cz, scale };
}

/** Screen direction from the centre toward a world point (for the ring arrow). */
export function directionTo(camera, point) {
  const p = project(camera, point);
  if (!p) return null;
  const dx = p.x - camera.cx;
  const dy = p.y - camera.cy;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, onScreen: p.z > 0 };
}
