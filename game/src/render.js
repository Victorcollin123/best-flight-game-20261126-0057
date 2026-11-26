// render.js — drawing only: the sky, the valley, the rings, the plane and the
// instruments. The 1280x720 playfield is scaled to fit the window and centred.

import { FIELD, FONT, PALETTE, RINGS, WORLD } from './config.js';
import { makeBasis, makeCamera, project } from './camera.js';
import { planeFaces, propHub } from './model.js';
import {
  SCREEN_CRASHED,
  SCREEN_LANDED,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './state.js';

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function hexMix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function headingName(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

export function createRenderer(canvas, terrain) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const speedLabel = cachedLabel('');
  const altLabel = cachedLabel('');
  const scoreLabel = cachedLabel('');
  const ringsLabel = cachedLabel('');
  const timeLabel = cachedLabel('');
  const fuelLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h, title) {
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(x, y, w, h);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, w, h);
    if (title) text(title, x + w / 2, y + 44, 30, PALETTE.text, 'center', '700');
  }

  function skyAndSun(camera) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.height * 0.62);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Low sun to the west, where the valley light comes from.
    const sun = project(camera, [-900, 300, 2400]);
    if (sun) {
      context.fillStyle = PALETTE.sun;
      context.beginPath();
      context.arc(sun.x, sun.y, 34 * Math.max(0.4, sun.scale), 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 217, 138, 0.25)';
      context.beginPath();
      context.arc(sun.x, sun.y, 62 * Math.max(0.4, sun.scale), 0, Math.PI * 2);
      context.fill();
    }
  }

  function terrainColour(x, z, h, cz) {
    let base;
    if (Math.abs(x - terrain.riverX(z)) < 20 && h < 24) base = PALETTE.river;
    else if (h > WORLD.snowLine) base = '#dfe8f2';
    else if (h > 150) base = PALETTE.rock;
    else if (h > 60) base = PALETTE.grass;
    else base = PALETTE.meadow;
    const haze = Math.min(1, cz / 1500) * 0.5;
    return hexMix(base, PALETTE.skyMid, haze);
  }

  function drawTerrain(camera) {
    const camZ = camera.position[2];
    const zFar = Math.min(4400, camZ + 1500);
    const zNear = Math.max(-220, camZ - 90);
    const zStep = 90;
    const xStep = 70;
    for (let z = zFar; z > zNear; z -= zStep) {
      const z2 = Math.max(zNear, z - zStep);
      for (let x = -700; x < 700; x += xStep) {
        const corners = [
          [x, terrain.groundAt(x, z), z],
          [x + xStep, terrain.groundAt(x + xStep, z), z],
          [x + xStep, terrain.groundAt(x + xStep, z2), z2],
          [x, terrain.groundAt(x, z2), z2],
        ];
        const pts = corners.map((c) => project(camera, c));
        if (pts.some((p) => p === null)) continue;
        const midH = (corners[0][1] + corners[2][1]) / 2;
        const midX = x + xStep / 2;
        const midZ = (z + z2) / 2;
        const cz = (pts[0].z + pts[2].z) / 2;
        context.fillStyle = terrainColour(midX, midZ, midH, cz);
        context.beginPath();
        context.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 4; i += 1) context.lineTo(pts[i].x, pts[i].y);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawRunway(camera) {
    for (const strip of [WORLD.takeoff, WORLD.landing]) {
      drawStrip(camera, strip);
    }
  }

  function drawStrip(camera, r) {
    const y = 6.6;
    const corners = [
      [r.x - r.width / 2, y, r.z - r.length / 2],
      [r.x + r.width / 2, y, r.z - r.length / 2],
      [r.x + r.width / 2, y, r.z + r.length / 2],
      [r.x - r.width / 2, y, r.z + r.length / 2],
    ];
    const pts = corners.map((c) => project(camera, c));
    if (pts.some((p) => p === null)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i += 1) context.lineTo(pts[i].x, pts[i].y);
    context.closePath();
    context.fill();
    // Centre dashes down the strip.
    context.fillStyle = PALETTE.runwayLine;
    for (let z = r.z - r.length / 2 + 24; z < r.z + r.length / 2 - 10; z += 48) {
      const d = [
        [r.x - 1.6, y + 0.15, z],
        [r.x + 1.6, y + 0.15, z],
        [r.x + 1.6, y + 0.15, z + 22],
        [r.x - 1.6, y + 0.15, z + 22],
      ].map((c) => project(camera, c));
      if (d.some((p) => p === null)) continue;
      context.beginPath();
      context.moveTo(d[0].x, d[0].y);
      for (let i = 1; i < 4; i += 1) context.lineTo(d[i].x, d[i].y);
      context.closePath();
      context.fill();
    }
  }

  function drawTrees(camera) {
    const visible = [];
    for (const tree of terrain.trees) {
      const p = project(camera, [tree.x, tree.h, tree.z]);
      if (!p || p.z > 1500) continue;
      visible.push({ tree, p });
    }
    visible.sort((a, b) => b.p.z - a.p.z);
    for (const { tree, p } of visible) {
      const size = tree.size * p.scale;
      if (size < 1.5) continue;
      const green = tree.shade > 0.9 ? '#2f5d33' : '#274a2b';
      context.fillStyle = green;
      context.beginPath();
      context.moveTo(p.x, p.y - size * 2.1);
      context.lineTo(p.x - size * 0.75, p.y - size * 0.5);
      context.lineTo(p.x + size * 0.75, p.y - size * 0.5);
      context.closePath();
      context.fill();
      context.fillStyle = '#1e3d24';
      context.beginPath();
      context.moveTo(p.x, p.y - size * 1.5);
      context.lineTo(p.x - size * 0.55, p.y);
      context.lineTo(p.x + size * 0.55, p.y);
      context.closePath();
      context.fill();
    }
  }

  function drawClouds(camera, elapsed) {
    context.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (const cloud of terrain.clouds) {
      const x = ((cloud.x + cloud.speed * elapsed + 600) % 1200) - 600;
      const p = project(camera, [x, cloud.y, cloud.z]);
      if (!p || p.z > 1800) continue;
      const s = cloud.size * p.scale;
      if (s < 4) continue;
      context.beginPath();
      context.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
      context.ellipse(p.x - s * 0.5, p.y + s * 0.08, s * 0.6, s * 0.24, 0, 0, Math.PI * 2);
      context.ellipse(p.x + s * 0.5, p.y + s * 0.06, s * 0.65, s * 0.26, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawRings(camera, state) {
    for (let i = 0; i < RINGS.length; i += 1) {
      const ring = RINGS[i];
      if (ring.z < camera.position[2] - 30 || ring.z > camera.position[2] + 1600) continue;
      const passed = i < state.nextRing;
      const isNext = i === state.nextRing;
      const pulse = isNext ? 1 + 0.03 * Math.sin(state.elapsed * 4) : 1;
      const r = ring.r * pulse;
      const points = [];
      for (let a = 0; a <= 28; a += 1) {
        const t = (a / 28) * Math.PI * 2;
        points.push(project(camera, [ring.x + Math.cos(t) * r, ring.y + Math.sin(t) * r, ring.z]));
      }
      if (points.some((p) => p === null)) continue;
      const stroke = (width, colour) => {
        context.strokeStyle = colour;
        context.lineWidth = width;
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let a = 1; a < points.length; a += 1) context.lineTo(points[a].x, points[a].y);
        context.closePath();
        context.stroke();
      };
      if (passed) {
        stroke(3, 'rgba(127, 208, 138, 0.8)');
      } else if (isNext) {
        stroke(14, PALETTE.ringGlow);
        stroke(4, PALETTE.ring);
      } else {
        stroke(8, 'rgba(255, 176, 58, 0.22)');
        stroke(2.5, 'rgba(255, 176, 58, 0.75)');
      }
    }
  }

  function drawShadow(camera, state) {
    const p = state.plane;
    const ground = terrain.groundAt(p.x, p.z);
    const height = p.y - ground;
    if (height > 120) return;
    const s = project(camera, [p.x, ground + 0.6, p.z]);
    if (!s) return;
    const radius = Math.max(3, 26 * s.scale * (1 - height / 160));
    context.fillStyle = `rgba(10, 14, 20, ${0.32 * (1 - height / 140)})`;
    context.beginPath();
    context.ellipse(s.x, s.y, radius, radius * 0.32, 0, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlane(camera, state) {
    const p = state.plane;
    const basis = makeBasis(p.heading, p.pitch, p.roll);
    const faces = planeFaces([p.x, p.y, p.z], basis);
    const projected = [];
    for (const face of faces) {
      const pts = face.points.map((pt) => project(camera, pt));
      if (pts.some((q) => q === null)) continue;
      const depth = pts.reduce((sum, q) => sum + q.z, 0) / pts.length;
      projected.push({ pts, colour: face.colour, depth });
    }
    projected.sort((a, b) => b.depth - a.depth);
    for (const face of projected) {
      context.fillStyle = face.colour;
      context.beginPath();
      context.moveTo(face.pts[0].x, face.pts[0].y);
      for (let i = 1; i < face.pts.length; i += 1) context.lineTo(face.pts[i].x, face.pts[i].y);
      context.closePath();
      context.fill();
    }
    // Spinning propeller disc, translucent so the nose reads through it.
    const hub = project(camera, propHub([p.x, p.y, p.z], basis));
    if (hub) {
      const radius = 1.6 * hub.scale;
      const angle = state.elapsed * 42;
      context.strokeStyle = 'rgba(240, 244, 248, 0.5)';
      context.lineWidth = Math.max(1, radius * 0.16);
      context.beginPath();
      context.ellipse(hub.x, hub.y, radius, radius, 0, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = 'rgba(240, 244, 248, 0.75)';
      context.lineWidth = Math.max(1.5, radius * 0.1);
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      context.beginPath();
      context.moveTo(hub.x - dx, hub.y - dy);
      context.lineTo(hub.x + dx, hub.y + dy);
      context.moveTo(hub.x + dy, hub.y - dx);
      context.lineTo(hub.x - dy, hub.y + dx);
      context.stroke();
    }
  }

  function drawCompass(state) {
    const degrees = ((state.plane.heading * 180) / Math.PI % 360 + 360) % 360;
    const cx = FIELD.width / 2;
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(cx - 190, 14, 380, 44);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(cx - 189.5, 14.5, 380, 44);
    context.save();
    context.beginPath();
    context.rect(cx - 190, 14, 380, 44);
    context.clip();
    for (let d = -90; d <= 90; d += 15) {
      const deg = Math.round(degrees + d);
      const norm = ((deg % 360) + 360) % 360;
      const x = cx + d * 2.1;
      const major = norm % 45 === 0;
      context.strokeStyle = major ? PALETTE.text : PALETTE.muted;
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(x, 22);
      context.lineTo(x, major ? 34 : 29);
      context.stroke();
      if (major) text(headingName(norm), x, 52, 13, PALETTE.text, 'center', '700');
    }
    context.restore();
    context.fillStyle = PALETTE.ring;
    context.beginPath();
    context.moveTo(cx, 16);
    context.lineTo(cx - 6, 26);
    context.lineTo(cx + 6, 26);
    context.closePath();
    context.fill();
    text(`${String(Math.round(degrees)).padStart(3, '0')}°`, cx, 72, 13, PALETTE.muted, 'center');
  }

  function drawTapes(state) {
    // Speed tape, left edge; altitude tape, right edge.
    const speedKt = Math.round(state.plane.speed * 1.94);
    const altFt = Math.round((state.plane.y - 6) * 3.28);
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(14, 120, 92, 220);
    context.fillRect(FIELD.width - 106, 120, 92, 220);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(14.5, 120.5, 92, 220);
    context.strokeRect(FIELD.width - 105.5, 120.5, 92, 220);
    text('SPD', 60, 140, 12, PALETTE.muted, 'center', '700');
    text('ALT', FIELD.width - 60, 140, 12, PALETTE.muted, 'center', '700');
    for (let i = -2; i <= 2; i += 1) {
      const y = 230 + i * 44;
      const spd = speedKt + i * 10;
      const alt = altFt + i * 100;
      if (spd >= 0) text(String(spd), 60, y, 13, i === 0 ? PALETTE.text : PALETTE.muted, 'center', i === 0 ? '700' : '');
      if (alt >= 0) text(String(alt), FIELD.width - 60, y, 13, i === 0 ? PALETTE.text : PALETTE.muted, 'center', i === 0 ? '700' : '');
    }
    context.fillStyle = PALETTE.ring;
    context.fillRect(96, 226, 10, 8);
    context.fillRect(FIELD.width - 106, 226, 10, 8);
  }

  function drawAttitude(state) {
    const cx = 92;
    const cy = FIELD.height - 92;
    const r = 58;
    context.save();
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.clip();
    context.translate(cx, cy);
    context.rotate(-state.camRoll);
    context.translate(0, state.camPitch * r * 1.4);
    context.fillStyle = '#7fb0d6';
    context.fillRect(-r, -r, r * 2, r);
    context.fillStyle = '#5d7d43';
    context.fillRect(-r, 0, r * 2, r);
    context.fillStyle = PALETTE.text;
    context.fillRect(-r, -1, r * 2, 2);
    context.restore();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.ring;
    context.beginPath();
    context.arc(cx, cy, 4, 0, Math.PI * 2);
    context.fill();
    text('ATT', cx, cy + r + 18, 12, PALETTE.muted, 'center', '700');
  }

  function drawBars(state) {
    const x = FIELD.width - 92;
    const y = FIELD.height - 150;
    // Throttle.
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(x, y, 26, 120);
    context.fillStyle = PALETTE.good;
    const th = state.plane.throttle * 112;
    context.fillRect(x + 4, y + 116 - th, 18, th);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(x + 0.5, y + 0.5, 26, 120);
    text('THR', x + 13, y + 138, 12, PALETTE.muted, 'center', '700');
    // Fuel.
    const fx = x + 40;
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(fx, y, 26, 120);
    const fuel = state.fuel / 100;
    context.fillStyle = fuel > 0.25 ? PALETTE.good : fuel > 0.1 ? PALETTE.warn : PALETTE.bad;
    const fh = fuel * 112;
    context.fillRect(fx + 4, y + 116 - fh, 18, fh);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(fx + 0.5, y + 0.5, 26, 120);
    text('FUEL', fx + 13, y + 138, 12, PALETTE.muted, 'center', '700');
    text(fuelLabel(`${Math.round(state.fuel)}%`), fx + 13, y - 8, 12, PALETTE.text, 'center', '700');
  }

  function drawHud(state) {
    const speedKt = Math.round(state.plane.speed * 1.94);
    const altFt = Math.round((state.plane.y - 6) * 3.28);
    // Top readouts: label on the left, number right-aligned in its box.
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(14, 14, 190, 44);
    context.fillRect(FIELD.width - 204, 14, 190, 44);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(14.5, 14.5, 190, 44);
    context.strokeRect(FIELD.width - 203.5, 14.5, 190, 44);
    text('SPD', 28, 46, 13, PALETTE.muted, 'left', '700');
    text(speedLabel(`${speedKt}`), 152, 46, 24, PALETTE.text, 'right', '700');
    text('KT', 190, 46, 13, PALETTE.muted, 'right', '700');
    text('ALT', FIELD.width - 190, 46, 13, PALETTE.muted, 'left', '700');
    text(altLabel(`${altFt.toLocaleString('en-US')}`), FIELD.width - 66, 46, 24, PALETTE.text, 'right', '700');
    text('FT', FIELD.width - 28, 46, 13, PALETTE.muted, 'right', '700');
    drawCompass(state);
    drawTapes(state);
    drawAttitude(state);
    drawBars(state);
    // Score strip, bottom centre.
    context.fillStyle = PALETTE.hudGlass;
    context.fillRect(FIELD.width / 2 - 210, FIELD.height - 52, 420, 38);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(FIELD.width / 2 - 209.5, FIELD.height - 51.5, 420, 38);
    text(scoreLabel(`SCORE ${state.score}`), FIELD.width / 2 - 196, FIELD.height - 26, 16, PALETTE.text, 'left', '700');
    text(ringsLabel(`RINGS ${state.ringsHit}/${RINGS.length}`), FIELD.width / 2, FIELD.height - 26, 16, PALETTE.text, 'center', '700');
    text(timeLabel(fmtTime(state.timeLeft)), FIELD.width / 2 + 196, FIELD.height - 26, 16, state.timeLeft < 30 ? PALETTE.bad : PALETTE.text, 'right', '700');
    // Centre reticle.
    context.strokeStyle = 'rgba(242, 244, 246, 0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(FIELD.width / 2 - 12, FIELD.height / 2);
    context.lineTo(FIELD.width / 2 + 12, FIELD.height / 2);
    context.moveTo(FIELD.width / 2, FIELD.height / 2 - 12);
    context.lineTo(FIELD.width / 2, FIELD.height / 2 + 12);
    context.stroke();
    // Next-ring arrow and distance: a label over the ring when it is in frame,
    // otherwise an arrow at the screen edge pointing toward it.
    const ring = RINGS[state.nextRing];
    if (ring && state.screen === SCREEN_PLAY) {
      const cam = cameraFor(state);
      const dx = ring.x - state.plane.x;
      const dy = ring.y - state.plane.y;
      const dz = ring.z - state.plane.z;
      const dist = Math.round(Math.hypot(dx, dy, dz));
      const seen = project(cam, [ring.x, ring.y, ring.z]);
      if (seen && seen.x > 40 && seen.x < FIELD.width - 40 && seen.y > 90 && seen.y < FIELD.height - 90) {
        text(`RING ${state.nextRing + 1}  ${dist}m`, seen.x, seen.y - 34, 14, PALETTE.ring, 'center', '700');
      } else if (seen) {
        const angle = Math.atan2(seen.y - FIELD.height / 2, seen.x - FIELD.width / 2);
        const ex = FIELD.width / 2 + Math.cos(angle) * 260;
        const ey = FIELD.height / 2 + Math.sin(angle) * 190;
        context.save();
        context.translate(ex, ey);
        context.rotate(angle + Math.PI / 2);
        context.fillStyle = PALETTE.ring;
        context.beginPath();
        context.moveTo(0, -12);
        context.lineTo(-9, 8);
        context.lineTo(9, 8);
        context.closePath();
        context.fill();
        context.restore();
        text(`RING ${state.nextRing + 1}  ${dist}m`, ex, ey + 30, 14, PALETTE.ring, 'center', '700');
      }
    }
    // Messages, below the compass so they never cover its degree readout.
    let my = 104;
    for (const m of state.messages) {
      const remain = m.until - state.elapsed;
      context.globalAlpha = Math.min(1, remain);
      text(m.text, FIELD.width / 2, my, 20, PALETTE.text, 'center', '700');
      context.globalAlpha = 1;
      my += 28;
    }
    // Lives.
    for (let i = 0; i < state.lives; i += 1) {
      const lx = 30 + i * 26;
      context.fillStyle = PALETTE.planeBody;
      context.beginPath();
      context.moveTo(lx, FIELD.height - 66);
      context.lineTo(lx + 18, FIELD.height - 66);
      context.lineTo(lx + 9, FIELD.height - 74);
      context.closePath();
      context.fill();
    }
  }

  function cameraFor(state) {
    const p = state.plane;
    const basis = makeBasis(p.heading, p.pitch, state.camRoll);
    const back = 13.5;
    const up = 4.4;
    const position = [
      p.x - basis.forward[0] * back + basis.up[0] * up,
      p.y - basis.forward[1] * back + basis.up[1] * up,
      p.z - basis.forward[2] * back + basis.up[2] * up,
    ];
    return makeCamera(position, p.heading, state.camPitch, state.camRoll);
  }

  function drawPanelScreen(state, title, lines, prompt, promptColour) {
    context.fillStyle = 'rgba(8, 12, 20, 0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const w = 640;
    const h = 130 + lines.length * 32;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    panel(x, y, w, h, title);
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, y + 92 + i * 32, 18, line.startsWith('+') ? PALETTE.good : PALETTE.text, 'center');
    });
    if (prompt) text(prompt, FIELD.width / 2, y + h - 26, 17, promptColour || PALETTE.ring, 'center', '700');
  }

  function draw(state) {
    context.save();
    context.scale(view.scale, view.scale);
    context.translate(view.x / view.scale, view.y / view.scale);
    const camera = cameraFor(state);
    skyAndSun(camera);
    drawClouds(camera, state.elapsed);
    drawTerrain(camera);
    drawRunway(camera);
    drawTrees(camera);
    drawRings(camera, state);
    drawShadow(camera, state);
    drawPlane(camera, state);
    if (state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSED || state.screen === SCREEN_CRASHED || state.screen === SCREEN_LANDED) {
      drawHud(state);
    }
    if (state.screen === SCREEN_TITLE) {
      drawHud(state);
      drawPanelScreen(
        state,
        'KESTREL RIDGE RUN',
        [
          'Thread all eight amber rings down the valley,',
          'then put her down gently on the far runway.',
          'Arrows or WASD fly · Shift / Ctrl throttle · P pauses',
          state.best > 0 ? `Best score: ${state.best}` : 'First flight — make it count',
        ],
        'Press Enter or click to fly',
      );
    } else if (state.screen === SCREEN_PAUSED) {
      drawPanelScreen(state, 'PAUSED', ['The valley waits.'], 'Press P to keep flying');
    } else if (state.screen === SCREEN_CRASHED) {
      drawPanelScreen(state, 'CRASHED', [`Lives left: ${state.lives}`], '');
    } else if (state.screen === SCREEN_LANDED) {
      drawPanelScreen(state, 'LANDED', [`+${250} — tanks full`, 'Throttle up and take off again'], '');
    } else if (state.screen === SCREEN_WIN) {
      drawPanelScreen(
        state,
        'COURSE COMPLETE',
        [`Score ${state.score}`, `Rings ${state.ringsHit}/${RINGS.length} · Time left ${fmtTime(state.timeLeft)}`, state.score > state.best ? 'New best score!' : `Best score: ${state.best}`],
        'Press R to fly again',
      );
    } else if (state.screen === SCREEN_OVER) {
      const reason = state.timeLeft <= 0 ? 'Out of time' : 'Out of lives';
      drawPanelScreen(
        state,
        'FLIGHT OVER',
        [reason, `Score ${state.score} · Rings ${state.ringsHit}/${RINGS.length}`, state.score > state.best ? 'New best score!' : `Best score: ${state.best}`],
        'Press R to fly again',
      );
    }
    context.restore();
  }

  return { draw, resize };
}
