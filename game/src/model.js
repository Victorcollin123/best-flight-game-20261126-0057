// model.js — the Kestrel bush plane as a low-poly polygon model in local space:
// nose points along local +z, wings along local +x, up along local +y.
// Faces carry a colour and a depth key so the renderer can paint them far to near.

import { PALETTE } from './config.js';

// Each face: [vertices in local space], colour key.
const FACES = [
  // Fuselage top (nose to tail, tapering).
  { v: [[-0.7, 0.55, 3.1], [0.7, 0.55, 3.1], [0.55, 0.75, -3.2], [-0.55, 0.75, -3.2]], c: 'body' },
  // Fuselage left side.
  { v: [[-0.7, 0.55, 3.1], [-0.55, 0.75, -3.2], [-0.5, -0.35, -3.2], [-0.65, -0.35, 3.1]], c: 'body' },
  // Fuselage right side.
  { v: [[0.7, 0.55, 3.1], [0.65, -0.35, 3.1], [0.5, -0.35, -3.2], [0.55, 0.75, -3.2]], c: 'body' },
  // Fuselage belly.
  { v: [[-0.65, -0.35, 3.1], [0.65, -0.35, 3.1], [0.5, -0.35, -3.2], [-0.5, -0.35, -3.2]], c: 'trim' },
  // Nose cap.
  { v: [[-0.7, 0.55, 3.1], [0.7, 0.55, 3.1], [0.65, -0.35, 3.1], [-0.65, -0.35, 3.1]], c: 'trim' },
  // Canopy (glass).
  { v: [[-0.5, 0.62, 1.4], [0.5, 0.62, 1.4], [0.42, 1.05, -0.4], [-0.42, 1.05, -0.4]], c: 'glass' },
  // Main wing (high wing, slight dihedral).
  { v: [[-5.4, 0.95, 1.1], [5.4, 0.95, 1.1], [5.4, 0.95, -0.5], [-5.4, 0.95, -0.5]], c: 'wing' },
  // Wing tips (orange, so the bank reads at a glance).
  { v: [[-5.4, 0.95, 1.1], [-4.6, 0.95, 1.1], [-4.6, 0.95, -0.5], [-5.4, 0.95, -0.5]], c: 'body' },
  { v: [[4.6, 0.95, 1.1], [5.4, 0.95, 1.1], [5.4, 0.95, -0.5], [4.6, 0.95, -0.5]], c: 'body' },
  // Tailplane.
  { v: [[-2.3, 0.55, -2.6], [2.3, 0.55, -2.6], [2.3, 0.55, -3.3], [-2.3, 0.55, -3.3]], c: 'wing' },
  // Fin.
  { v: [[0, 0.7, -2.4], [0, 0.7, -3.4], [0, 2.1, -3.4]], c: 'body' },
  // Landing gear struts.
  { v: [[-0.5, -0.35, 1.6], [-0.5, -1.15, 1.6], [-0.42, -1.15, 1.6], [-0.42, -0.35, 1.6]], c: 'trim' },
  { v: [[0.5, -0.35, 1.6], [0.5, -1.15, 1.6], [0.42, -1.15, 1.6], [0.42, -0.35, 1.6]], c: 'trim' },
];

const COLOURS = {
  body: PALETTE.planeBody,
  wing: PALETTE.planeWing,
  trim: PALETTE.planeTrim,
  glass: '#9fd4e8',
};

/** World-space faces for the plane at `position` with basis (forward, right, up). */
export function planeFaces(position, basis) {
  const out = [];
  for (const face of FACES) {
    const world = face.v.map(([lx, ly, lz]) => [
      position[0] + basis.right[0] * lx + basis.up[0] * ly + basis.forward[0] * lz,
      position[1] + basis.right[1] * lx + basis.up[1] * ly + basis.forward[1] * lz,
      position[2] + basis.right[2] * lx + basis.up[2] * ly + basis.forward[2] * lz,
    ]);
    out.push({ points: world, colour: COLOURS[face.c] });
  }
  return out;
}

/** Propeller hub position (world space) for the spinning disc. */
export function propHub(position, basis) {
  return [
    position[0] + basis.forward[0] * 3.35,
    position[1] + basis.forward[1] * 3.35,
    position[2] + basis.forward[2] * 3.35,
  ];
}
