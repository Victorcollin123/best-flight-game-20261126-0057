// config.js — every tuning number, colour and course waypoint in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The world is metres: x east, y up, z north along the valley. */
export const WORLD = {
  seed: 20261126,
  valleyHalfWidth: 260,
  ridgeHeight: 320,
  snowLine: 210,
  courseLength: 4200,
  takeoff: { x: -40, z: 300, length: 420, width: 46 },
  landing: { x: -40, z: 3900, length: 420, width: 46, approach: 350 },
};

export const PLANE = {
  cruiseSpeed: 62,
  maxSpeed: 96,
  minSpeed: 24,
  stallSpeed: 30,
  climbRate: 26,
  rollRate: 2.4,
  pitchRate: 1.1,
  turnRate: 0.55,
  accel: 26,
  drag: 0.12,
  sinkRate: 6, // m/s of sink at zero speed, tapering to none at stall speed
};

/** Rings thread the valley from the runway start to the far meadow. */
export const RINGS = [
  { x: 30, y: 66, z: 420, r: 26 },
  { x: 50, y: 78, z: 900, r: 26 },
  { x: 90, y: 92, z: 1380, r: 24 },
  { x: -30, y: 84, z: 1860, r: 24 },
  { x: 110, y: 110, z: 2340, r: 24 },
  { x: 45, y: 96, z: 2820, r: 22 },
  { x: 40, y: 118, z: 3300, r: 22 },
  { x: 55, y: 85, z: 3450, r: 24 },
];

export const GAME = {
  timeLimit: 180,
  lives: 3,
  fuelMax: 100,
  fuelBurn: 0.55,
  ringPoints: 100,
  landingPoints: 250,
  winBonus: 500,
};

export const PALETTE = {
  backdrop: '#0e1420',
  skyTop: '#2f5d8a',
  skyMid: '#7fb0d6',
  skyLow: '#f6c98a',
  sun: '#ffd98a',
  ridgeFar: '#5d7396',
  ridgeNear: '#46586e',
  rock: '#5f6b5e',
  grass: '#5d7d43',
  meadow: '#7ba24e',
  river: '#4f8fb8',
  runway: '#3a3f46',
  runwayLine: '#f2f0e6',
  ring: '#ffb03a',
  ringGlow: 'rgba(255, 176, 58, 0.35)',
  planeBody: '#e8632c',
  planeWing: '#f4ede0',
  planeTrim: '#1f3a5f',
  panel: '#10151f',
  panelEdge: '#2c3648',
  text: '#f2f4f6',
  muted: '#9aa7b8',
  good: '#7fd08a',
  warn: '#ffb03a',
  bad: '#ff6b5e',
  hudGlass: 'rgba(10, 16, 26, 0.62)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'kestrel-ridge-run.best';
