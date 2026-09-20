import { useRef, useEffect, useCallback } from 'react';

// ---- geometry ----
const W = 500;
const H = 500;
const TRACK_LEFT = 96;
const TRACK_RIGHT = 404;
const TICKS = 9;                 // discrete positions 0..8
const CENTER_TICK = 4;
const TICK_GAP = (TRACK_RIGHT - TRACK_LEFT) / (TICKS - 1);
const SLIDER_COUNT = 5;
const ROW_GAP = 62;
const THUMB_HALF_W = 6;
const THUMB_HALF_H = 14;

// ---- palette ----
const INK = '#2c3e50';
const TRACK = '#e5e7eb';
const TICK_DOT = '#cbd2d9';
const ARM = '#5b6b7a';
const BLUE = '#3498db';
const RED = '#e74c3c';
const BLADE = '#8ce9ff';
const BLADE_TTL = 0.22; // seconds a blade-trail point lingers before it fades

type Team = 'blue' | 'red';

interface Slider {
  rowY: number;
  tick: number;
  displayTick: number;
  active: boolean;   // thumb visible / interactable
  alpha: number;     // fade-in after respawn
  respawnAt: number; // 0 = not respawning
}

interface Arm {
  team: Team;
  slider: number;
  dir: number;       // +1 pushes right, -1 pushes left
  t: number;         // seconds alive
  phase: 'in' | 'push' | 'move' | 'out';
  reach: number;     // 0 (off edge) .. 1 (contact) .. slightly past on shove
  pushed: boolean;
  extra: boolean;    // will attempt a second tick
  pushT: number;     // dwell timer while in contact
  shoulderY: number; // eased base row (so hopping between sliders is smooth)
  moveT: number;     // 0..1 while gliding to another slider
  travelFromX: number;
  travelFromY: number;
  hopChance: number; // decaying chance to hop to another slider instead of retiring
  baseOff: number;   // per-arm vertical offset of the off-screen base -> varied entry angle
  outX: number;      // horizontal slide-off offset during retract
  alpha: number;
  bend: number;      // signed elbow bow amount (px), varied per arm
}

const HOP_DECAY = 0.5;
const MOVE_DUR = 0.55; // seconds to glide between sliders

interface LimbPiece {
  cx: number; cy: number;   // centroid position
  vx: number; vy: number;
  rot: number; vr: number;
  local: { x: number; y: number }[]; // severed joints relative to centroid
  team: Team;
  maxR: number;             // for off-screen culling
}

interface FallingThumb {
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number; alpha: number;
}

interface BladePoint { x: number; y: number; age: number; }

const tickX = (t: number) => TRACK_LEFT + t * TICK_GAP;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const SliderTug = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const slidersRef = useRef<Slider[]>([]);
  const armsRef = useRef<Arm[]>([]);
  const limbsRef = useRef<LimbPiece[]>([]);
  const fallThumbsRef = useRef<FallingThumb[]>([]);
  const spawnRef = useRef<{ blue: number; red: number }>({ blue: 0.6, red: 1.1 });

  // interaction
  const dragRef = useRef<number | null>(null);
  const armedRef = useRef(false);
  const bladeRef = useRef<BladePoint[]>([]);
  const lastBladeRef = useRef<{ x: number; y: number } | null>(null);

  const init = useCallback(() => {
    const totalH = (SLIDER_COUNT - 1) * ROW_GAP;
    const startY = H / 2 - totalH / 2;
    slidersRef.current = Array.from({ length: SLIDER_COUNT }, (_, i) => ({
      rowY: startY + i * ROW_GAP,
      tick: CENTER_TICK,
      displayTick: CENTER_TICK,
      active: true,
      alpha: 1,
      respawnAt: 0,
    }));
    armsRef.current = [];
    limbsRef.current = [];
    fallThumbsRef.current = [];
  }, []);

  const spawnArm = useCallback((team: Team) => {
    const sliders = slidersRef.current;
    const dir = team === 'blue' ? 1 : -1;
    // prefer sliders that aren't already won for this team and are active
    const candidates = sliders
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.active && !(dir > 0 ? s.tick >= TICKS - 1 : s.tick <= 0));
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const baseOff = -72 + Math.random() * 144; // enter from above / level / below
    const bend = (11 + Math.random() * 27) * (Math.random() < 0.5 ? 1 : -1); // varied elbow
    armsRef.current.push({
      team,
      slider: pick.i,
      dir,
      t: 0,
      phase: 'in',
      reach: 0,
      pushed: false,
      extra: Math.random() < 0.3,
      pushT: 0,
      shoulderY: pick.s.rowY + baseOff,
      moveT: 0,
      travelFromX: 0,
      travelFromY: 0,
      hopChance: 0.75,
      baseOff,
      outX: 0,
      alpha: 1,
      bend,
    });
  }, []);

  const winSlider = useCallback((s: Slider, dir: number) => {
    const x = tickX(dir > 0 ? TICKS - 1 : 0);
    fallThumbsRef.current.push({
      x,
      y: s.rowY,
      vx: dir * (0.6 + Math.random() * 0.6),
      vy: -1.4,
      rot: 0,
      vr: dir * (0.12 + Math.random() * 0.08),
      alpha: 1,
    });
    s.active = false;
    s.alpha = 0;
    s.respawnAt = 0.9; // seconds until it fades back in centered
  }, []);

  const update = useCallback((dt: number) => {
    const sliders = slidersRef.current;

    // ---- spawn timers (equilibrium unless one team is starved by slicing) ----
    const s = spawnRef.current;
    s.blue -= dt;
    s.red -= dt;
    const countTeam = (team: Team) => armsRef.current.filter((a) => a.team === team).length;
    if (s.blue <= 0) {
      if (countTeam('blue') < 3) spawnArm('blue');
      s.blue = 1.9 + Math.random() * 1.1;
    }
    if (s.red <= 0) {
      if (countTeam('red') < 3) spawnArm('red');
      s.red = 1.9 + Math.random() * 1.1;
    }

    // ---- sliders: respawn + smooth display ----
    for (const sl of sliders) {
      if (!sl.active) {
        if (sl.respawnAt > 0) {
          sl.respawnAt -= dt;
          if (sl.respawnAt <= 0) {
            sl.tick = CENTER_TICK;
            sl.displayTick = CENTER_TICK;
            sl.active = true;
          }
        }
      } else if (sl.alpha < 1) {
        sl.alpha = Math.min(1, sl.alpha + dt * 2.2);
      }
      sl.displayTick += (sl.tick - sl.displayTick) * Math.min(1, dt * 12);
    }

    // ---- arms ----
    armsRef.current = armsRef.current.filter((a) => {
      a.t += dt;
      const sl = sliders[a.slider];
      // ease the (off-screen) base toward the current target row for smooth hops
      a.shoulderY += (sl.rowY + a.baseOff - a.shoulderY) * Math.min(1, dt * 4);

      if (a.phase === 'in') {
        a.reach = Math.min(1, a.reach + dt * 0.7); // slow, deliberate reach
        if (a.reach >= 1) { a.phase = 'push'; a.pushT = 0; a.pushed = false; }
      } else if (a.phase === 'push') {
        a.pushT += dt;
        a.reach = Math.min(1.14, a.reach + dt * 0.9); // gentle shove past contact
        if (!a.pushed) {
          a.pushed = true;
          if (sl.active) {
            sl.tick = clamp(sl.tick + a.dir, 0, TICKS - 1);
            if (a.extra) sl.tick = clamp(sl.tick + a.dir, 0, TICKS - 1);
            if (sl.tick <= 0 || sl.tick >= TICKS - 1) winSlider(sl, a.dir);
          }
        }
        if (a.pushT > 0.55) {
          // decaying chance to glide on to another slider instead of retiring
          const others = sliders
            .map((s, i) => ({ s, i }))
            .filter(({ s, i }) => i !== a.slider && s.active &&
              !(a.dir > 0 ? s.tick >= TICKS - 1 : s.tick <= 0));
          if (others.length > 0 && Math.random() < a.hopChance) {
            a.travelFromX = tickX(sl.displayTick) + a.dir * (THUMB_HALF_W + 6);
            a.travelFromY = sl.rowY;
            a.slider = others[Math.floor(Math.random() * others.length)].i;
            a.moveT = 0;
            a.pushed = false;
            a.hopChance *= HOP_DECAY;
            a.phase = 'move';
          } else {
            a.phase = 'out';
          }
        }
      } else if (a.phase === 'move') {
        a.moveT = Math.min(1, a.moveT + dt / MOVE_DUR);
        if (a.moveT >= 1) { a.phase = 'push'; a.pushT = 0; a.reach = 1; a.pushed = false; }
      } else {
        // 'out' — translate the whole arm horizontally off its entry edge (no squish)
        a.outX += (a.team === 'blue' ? -1 : 1) * 340 * dt;
        const contactX = tickX(sl.displayTick) + a.dir * (THUMB_HALF_W + 6);
        if (a.team === 'blue' ? contactX + a.outX < -70 : contactX + a.outX > W + 70) return false;
      }
      return true;
    });

    // ---- severed limb pieces / falling thumbs (rigid, gravity + spin) ----
    limbsRef.current = limbsRef.current.filter((L) => {
      L.vy += dt * 26;
      L.cx += L.vx * dt * 60;
      L.cy += L.vy * dt * 60;
      L.rot += L.vr * dt * 60;
      return L.cy - L.maxR < H + 60; // cull once fully off the bottom
    });
    fallThumbsRef.current = fallThumbsRef.current.filter((f) => {
      f.vy += dt * 26;
      f.x += f.vx * dt * 60;
      f.y += f.vy * dt * 60;
      f.rot += f.vr;
      f.alpha -= dt * 0.5;
      return f.alpha > 0 && f.y < H + 60;
    });

    // ---- blade trail aging ----
    bladeRef.current.forEach((p) => (p.age += dt));
    bladeRef.current = bladeRef.current.filter((p) => p.age < BLADE_TTL);
  }, [spawnArm, winSlider]);

  // 2-bone IK -> returns shoulder, elbow, hand
  const armJoints = useCallback((a: Arm) => {
    const sl = slidersRef.current[a.slider];
    const fromLeft = a.team === 'blue';
    const sx = fromLeft ? -24 : W + 24;
    const sy = a.shoulderY;
    // contact point on the pushing face of the thumb
    const contactX = tickX(sl.displayTick) + a.dir * (THUMB_HALF_W + 6);
    const contactY = sl.rowY;
    let hx: number;
    let hy: number;
    if (a.phase === 'move') {
      // glide directly from the previous slider to the new one
      const e = easeInOut(clamp(a.moveT, 0, 1));
      hx = a.travelFromX + (contactX - a.travelFromX) * e;
      hy = a.travelFromY + (contactY - a.travelFromY) * e;
    } else {
      const rr = easeInOut(Math.min(1, a.reach));
      const shove = a.reach > 1 ? (a.reach - 1) * a.dir * 20 : 0;
      hx = sx + (contactX - sx) * rr + shove;
      hy = sy + (contactY - sy) * rr;
    }
    // one gentle bend (a soft bow), never an extreme fold
    const mx = (sx + hx) / 2;
    const my = (sy + hy) / 2;
    const dx = hx - sx;
    const dy = hy - sy;
    const len = Math.hypot(dx, dy) || 1;
    const perpx = -dy / len;
    const perpy = dx / len;
    const bow = a.bend;
    const ex = mx + perpx * bow;
    const ey = my + perpy * bow;
    // during retract the whole limb slides off horizontally, keeping its shape
    const ox = a.phase === 'out' ? a.outX : 0;
    return { sx: sx + ox, sy, ex: ex + ox, ey, hx: hx + ox, hy };
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    // ---- tracks ----
    for (const sl of slidersRef.current) {
      ctx.strokeStyle = TRACK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(TRACK_LEFT, sl.rowY);
      ctx.lineTo(TRACK_RIGHT, sl.rowY);
      ctx.stroke();
      // tick dots
      for (let t = 0; t < TICKS; t++) {
        ctx.fillStyle = TICK_DOT;
        ctx.beginPath();
        ctx.arc(tickX(t), sl.rowY, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // thumb
      if (sl.active || sl.alpha > 0) {
        const x = tickX(sl.displayTick);
        ctx.save();
        ctx.globalAlpha = sl.alpha;
        ctx.fillStyle = INK;
        roundRect(ctx, x - THUMB_HALF_W, sl.rowY - THUMB_HALF_H, THUMB_HALF_W * 2, THUMB_HALF_H * 2, 4);
        ctx.fill();
        ctx.restore();
      }
    }

    // ---- falling won-thumbs ----
    for (const f of fallThumbsRef.current) {
      ctx.save();
      ctx.globalAlpha = clamp(f.alpha, 0, 1);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.fillStyle = INK;
      roundRect(ctx, -THUMB_HALF_W, -THUMB_HALF_H, THUMB_HALF_W * 2, THUMB_HALF_H * 2, 4);
      ctx.fill();
      ctx.restore();
    }

    // ---- arms (solid, softly-jointed limbs) ----
    for (const a of armsRef.current) {
      const j = armJoints(a);
      const teamColor = a.team === 'blue' ? BLUE : RED;
      ctx.save();
      ctx.globalAlpha = a.alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // limb
      ctx.strokeStyle = ARM;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(j.sx, j.sy);
      ctx.lineTo(j.ex, j.ey);
      ctx.lineTo(j.hx, j.hy);
      ctx.stroke();
      // bracelet on the forearm near the wrist
      drawBracelet(ctx, j.ex, j.ey, j.hx, j.hy, teamColor);
      // hand: a real palm with fingers, pushing the thumb
      const fdx = j.hx - j.ex;
      const fdy = j.hy - j.ey;
      const flen = Math.hypot(fdx, fdy) || 1;
      drawPushHand(ctx, j.hx, j.hy, fdx / flen, fdy / flen);
      ctx.restore();
    }

    // ---- severed limb pieces (solid, tumbling) ----
    for (const L of limbsRef.current) {
      const cos = Math.cos(L.rot);
      const sin = Math.sin(L.rot);
      const world = L.local.map((p) => ({
        x: L.cx + p.x * cos - p.y * sin,
        y: L.cy + p.x * sin + p.y * cos,
      }));
      const n = world.length;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // limb
      ctx.strokeStyle = ARM;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(world[0].x, world[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(world[i].x, world[i].y);
      ctx.stroke();
      // bracelet on the final (forearm) segment
      const A = world[n - 2];
      const B = world[n - 1];
      drawBracelet(ctx, A.x, A.y, B.x, B.y, L.team === 'blue' ? BLUE : RED);
      // hand
      const ux = B.x - A.x;
      const uy = B.y - A.y;
      const ln = Math.hypot(ux, uy) || 1;
      drawPushHand(ctx, B.x, B.y, ux / ln, uy / ln);
      ctx.restore();
    }

    // ---- edge fog: arms go foggy as they enter / leave the canvas edges ----
    drawEdgeFog(ctx);

    // ---- blade: instant, tapers thick (leading edge) -> thin (tail), fades out ----
    const pts = bladeRef.current;
    if (pts.length > 1) {
      const n = pts.length;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = BLADE;
      for (let i = 1; i < n; i++) {
        const t = i / (n - 1);                          // 0 = back, 1 = front
        const fade = clamp(1 - pts[i].age / BLADE_TTL, 0, 1);
        ctx.globalAlpha = fade;
        ctx.shadowBlur = 10 * t;
        ctx.lineWidth = 1 + t * 6.5;                    // thick at the leading edge
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      // soft glow riding the leading tip
      const tip = pts[n - 1];
      const tipFade = clamp(1 - tip.age / BLADE_TTL, 0, 1);
      if (tipFade > 0.4) {
        const R = 24;
        const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, R);
        g.addColorStop(0, `rgba(140,233,255,${0.5 * tipFade})`);
        g.addColorStop(1, 'rgba(140,233,255,0)');
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [armJoints]);

  const frame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const last = lastRef.current || now;
    const dt = Math.min(0.05, (now - last) / 1000);
    lastRef.current = now;
    update(dt);
    draw(ctx);
    rafRef.current = requestAnimationFrame(frame);
  }, [update, draw]);

  useEffect(() => {
    init();
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [init, frame]);

  // ---- pointer handling ----
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (cx - rect.left) * (W / rect.width),
      y: (cy - rect.top) * (H / rect.height),
    };
  };

  const thumbAt = (x: number, y: number) => {
    const sliders = slidersRef.current;
    for (let i = 0; i < sliders.length; i++) {
      const sl = sliders[i];
      if (!sl.active) continue;
      const tx = tickX(sl.displayTick);
      if (Math.abs(x - tx) < 16 && Math.abs(y - sl.rowY) < 22) return i;
    }
    return null;
  };

  const severTest = (x0: number, y0: number, x1: number, y1: number) => {
    for (let ai = armsRef.current.length - 1; ai >= 0; ai--) {
      const a = armsRef.current[ai];
      const j = armJoints(a);
      const bones = [
        { cx: j.sx, cy: j.sy, dx: j.ex, dy: j.ey }, // upper arm
        { cx: j.ex, cy: j.ey, dx: j.hx, dy: j.hy }, // forearm
      ];
      let hitBone = -1;
      let u = 0;
      for (let b = 0; b < bones.length; b++) {
        const bn = bones[b];
        const hit = segHitU(x0, y0, x1, y1, bn.cx, bn.cy, bn.dx, bn.dy);
        if (hit !== null) { hitBone = b; u = hit; break; }
      }
      if (hitBone < 0) continue;

      // exact cut point on the bone, and the outboard joints that fall away
      const bn = bones[hitBone];
      const cutX = bn.cx + (bn.dx - bn.cx) * u;
      const cutY = bn.cy + (bn.dy - bn.cy) * u;
      const joints = hitBone === 0
        ? [{ x: cutX, y: cutY }, { x: j.ex, y: j.ey }, { x: j.hx, y: j.hy }]
        : [{ x: cutX, y: cutY }, { x: j.hx, y: j.hy }];

      let mx = 0;
      let my = 0;
      for (const p of joints) { mx += p.x; my += p.y; }
      mx /= joints.length;
      my /= joints.length;
      const local = joints.map((p) => ({ x: p.x - mx, y: p.y - my }));
      let maxR = 0;
      for (const p of local) maxR = Math.max(maxR, Math.hypot(p.x, p.y));
      maxR += 24;

      // fling it along the slice direction, then let gravity take it off the bottom
      const bdx = x1 - x0;
      const bdy = y1 - y0;
      const bmag = Math.hypot(bdx, bdy) || 1;
      limbsRef.current.push({
        cx: mx,
        cy: my,
        vx: (bdx / bmag) * 2.6 + (Math.random() - 0.5),
        vy: (bdy / bmag) * 2.6 - 0.6,
        rot: 0,
        vr: (Math.random() - 0.5) * 0.26,
        local,
        team: a.team,
        maxR,
      });
      armsRef.current.splice(ai, 1);
      // starve the cut team -> natural advantage to the other side
      spawnRef.current[a.team] += 2.6;
    }
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    const ti = thumbAt(pos.x, pos.y);
    if (ti !== null) {
      dragRef.current = ti;
      return;
    }
    // blade is live immediately — no hold/charge — and starts a fresh trail
    armedRef.current = true;
    bladeRef.current = [{ x: pos.x, y: pos.y, age: 0 }];
    lastBladeRef.current = { x: pos.x, y: pos.y };
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPos(e);
    if (dragRef.current !== null) {
      e.preventDefault();
      const sl = slidersRef.current[dragRef.current];
      sl.tick = clamp(Math.round((pos.x - TRACK_LEFT) / TICK_GAP), 0, TICKS - 1); // discrete snap
      return;
    }
    if (!armedRef.current) return;
    e.preventDefault();
    const prev = lastBladeRef.current;
    if (prev) severTest(prev.x, prev.y, pos.x, pos.y);
    bladeRef.current.push({ x: pos.x, y: pos.y, age: 0 });
    lastBladeRef.current = { x: pos.x, y: pos.y };
  };

  const onUp = () => {
    dragRef.current = null;
    armedRef.current = false; // stop cutting; leftover trail ages out on its own
    lastBladeRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ cursor: dragRef.current !== null ? 'grabbing' : 'crosshair', touchAction: 'none' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
    />
  );
};

// ---- helpers ----
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// soft background-tinted fog at the left/right edges so limbs blur in and out
function drawEdgeFog(ctx: CanvasRenderingContext2D) {
  const F = 74;
  const c = 'rgba(244,244,245,';
  const left = ctx.createLinearGradient(0, 0, F, 0);
  left.addColorStop(0, c + '0.95)');
  left.addColorStop(1, c + '0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, F, H);
  const right = ctx.createLinearGradient(W, 0, W - F, 0);
  right.addColorStop(0, c + '0.95)');
  right.addColorStop(1, c + '0)');
  ctx.fillStyle = right;
  ctx.fillRect(W - F, 0, F, H);
}

// chunky round bracelet wrapping the forearm near the wrist
function drawBracelet(
  ctx: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number, color: string,
) {
  const cx = ax + (bx - ax) * 0.87;
  const cy = ay + (by - ay) * 0.87;
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.save();
  ctx.fillStyle = color;
  // bead: short along the arm, bulging wider than the limb
  ctx.beginPath();
  ctx.ellipse(cx, cy, 7, 10, ang, 0, Math.PI * 2);
  ctx.fill();
  // soft inner sheen
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx - Math.sin(ang) * 3, cy + Math.cos(ang) * 3, 3, 5, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPushHand(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number, ux: number, uy: number,
) {
  const px = -uy;
  const py = ux;
  const ang = Math.atan2(uy, ux);
  const palmX = hx - ux * 5;
  const palmY = hy - uy * 5;
  ctx.save();
  ctx.fillStyle = ARM;
  ctx.strokeStyle = ARM;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // palm
  ctx.beginPath();
  ctx.ellipse(palmX, palmY, 8.5, 7.5, ang, 0, Math.PI * 2);
  ctx.fill();
  // four fingers reaching toward the thumb
  ctx.lineWidth = 3.4;
  const offs = [-6, -2, 2, 6];
  const lens = [8, 10, 10, 8];
  for (let i = 0; i < 4; i++) {
    const bx = palmX + px * offs[i] + ux * 3;
    const by = palmY + py * offs[i] + uy * 3;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + ux * lens[i], by + uy * lens[i]);
    ctx.stroke();
  }
  // thumb off to one side
  ctx.lineWidth = 3.8;
  const tbx = palmX + px * 8;
  const tby = palmY + py * 8;
  ctx.beginPath();
  ctx.moveTo(tbx, tby);
  ctx.lineTo(tbx + ux * 6 - px * 1.5, tby + uy * 6 - py * 1.5);
  ctx.stroke();
  ctx.restore();
}

// where blade AB crosses bone CD: returns u (0..1 along CD) at the cut, or null
function segHitU(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number | null {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (denom === 0) return null;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return u;
  return null;
}

export default SliderTug;
