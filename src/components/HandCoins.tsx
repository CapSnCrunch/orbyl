import { useRef, useEffect, useCallback } from 'react';

const W = 500;
const H = 500;
const CATCH_Y = 404;

const INK = '#2c3e50';
const ARM = '#5b6b7a';
const GLOVE = '#f7f8fa';

// three tiers, distinguished only by color + size
const DENOMS = [
  { value: 0.01, r: 14, face: '#c8823c', edge: '#8a531f' }, // copper, small
  { value: 0.1, r: 18, face: '#b9bdc3', edge: '#7f858c' },  // silver, medium
  { value: 1.0, r: 22, face: '#d9b44a', edge: '#7c5f1f' },  // gold, large
];
const pickDenom = () => {
  const r = Math.random();
  return r < 0.62 ? 0 : r < 0.9 ? 1 : 2; // copper common, gold rare
};

const SPAWN_S = 0.1; // while held, emit a coin every ~100ms

interface FallCoin {
  x: number; y: number; vx: number; vy: number;
  d: number; spin: number; spinV: number; pop: number;
}
interface Spark { x: number; y: number; vx: number; vy: number; alpha: number; color: string; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const HandCoins = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const fallRef = useRef<FallCoin[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const handRef = useRef({ x: -120, y: CATCH_Y });
  const heldRef = useRef(false);
  const pointerRef = useRef({ x: W / 2, y: H / 2 });
  const spawnAccRef = useRef(0);

  const totalRef = useRef(0);
  const dispTotalRef = useRef(0);
  const sinceCatchRef = useRef(999);
  const totalAlphaRef = useRef(0);
  const totalPopRef = useRef(1);

  const spawnCoin = useCallback((x: number, y: number) => {
    fallRef.current.push({
      x, y,
      vx: (Math.random() - 0.5) * 40,
      vy: 0,
      d: pickDenom(),
      spin: 0,
      spinV: (6 + Math.random() * 7) * (Math.random() < 0.5 ? 1 : -1),
      pop: 0.22, // pops into existence
    });
  }, []);

  const update = useCallback((dt: number) => {
    // ---- emit a stream of coins while held ----
    if (heldRef.current) {
      spawnAccRef.current += dt;
      while (spawnAccRef.current >= SPAWN_S) {
        spawnAccRef.current -= SPAWN_S;
        spawnCoin(pointerRef.current.x, pointerRef.current.y);
      }
    }

    // ---- falling coins (pop-in + gravity + 3D spin) ----
    const fall = fallRef.current;
    for (let i = fall.length - 1; i >= 0; i--) {
      const c = fall[i];
      c.pop += (1 - c.pop) * Math.min(1, dt * 16);
      c.vy += 1100 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.spin += c.spinV * dt;
      if (c.y >= CATCH_Y) {
        const dn = DENOMS[c.d];
        totalRef.current += dn.value;
        sinceCatchRef.current = 0;
        totalPopRef.current = 1.16;
        for (let s = 0; s < 6; s++) {
          sparksRef.current.push({
            x: c.x, y: CATCH_Y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3,
            alpha: 1,
            color: dn.face,
          });
        }
        fall.splice(i, 1);
      }
    }

    // ---- hand chases lowest coin, else retreats off-screen ----
    let target = { x: -120, y: CATCH_Y };
    if (fall.length > 0) {
      let low = fall[0];
      for (const c of fall) if (c.y > low.y) low = c;
      target = { x: clamp(low.x, 30, W - 20), y: CATCH_Y };
    }
    const lerp = Math.min(1, 0.16 + fall.length * 0.06);
    handRef.current.x += (target.x - handRef.current.x) * lerp;
    handRef.current.y += (target.y - handRef.current.y) * lerp;

    // ---- sparks ----
    sparksRef.current = sparksRef.current.filter((s) => {
      s.vy += 18 * dt;
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= dt * 2.4;
      return s.alpha > 0;
    });

    // ---- running total (ticker + fade) ----
    dispTotalRef.current += (totalRef.current - dispTotalRef.current) * Math.min(1, dt * 9);
    if (Math.abs(totalRef.current - dispTotalRef.current) < 0.004) dispTotalRef.current = totalRef.current;
    totalPopRef.current += (1 - totalPopRef.current) * Math.min(1, dt * 8);
    sinceCatchRef.current += dt;
    const wantAlpha = sinceCatchRef.current < 2.2 ? 1 : 0;
    totalAlphaRef.current += (wantAlpha - totalAlphaRef.current) * Math.min(1, dt * 4);
  }, [spawnCoin]);

  const drawCoin = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, d: number, scale: number, spin: number) => {
    const dn = DENOMS[d];
    const r = dn.r * scale;
    const s = Math.abs(Math.cos(spin)); // 1 = flat face, 0 = edge-on
    const ry = Math.max(0.7, r * s);
    const thick = 3.5;
    const rad = Math.min(r, ry + thick / 2);
    ctx.fillStyle = dn.edge;
    roundRect(ctx, x - r, y - ry - thick / 2, r * 2, ry * 2 + thick, rad);
    ctx.fill();
    ctx.fillStyle = dn.face;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, r - 1.7), Math.max(0.5, ry - 1.7), 0, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    // ---- running total (centered, behind coins) ----
    const ta = totalAlphaRef.current;
    if (ta > 0.01) {
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.translate(W / 2, H / 2);
      ctx.scale(totalPopRef.current, totalPopRef.current);
      ctx.fillStyle = INK;
      ctx.font = "300 46px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${dispTotalRef.current.toFixed(2)}`, 0, 0);
      ctx.restore();
    }

    // ---- catcher: horizontal arm + cupped hand ----
    const sx = -60;
    const hx = handRef.current.x;
    const hy = handRef.current.y;
    ctx.save();
    ctx.strokeStyle = ARM;
    ctx.lineCap = 'round';
    ctx.lineWidth = 19;
    ctx.beginPath();
    ctx.moveTo(sx, hy);
    ctx.lineTo(hx - 14, hy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(72,86,99,0.55)';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(hx - 24, hy - 12);
    ctx.lineTo(hx - 24, hy + 12);
    ctx.stroke();
    ctx.restore();
    drawCatchHand(ctx, hx, hy);

    // ---- falling coins ----
    for (const c of fallRef.current) drawCoin(ctx, c.x, c.y, c.d, c.pop, c.spin);

    // ---- sparks ----
    for (const s of sparksRef.current) {
      ctx.save();
      ctx.globalAlpha = clamp(s.alpha, 0, 1);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- edge fog: the arm blurs in / out at the canvas edges ----
    drawEdgeFog(ctx);
  }, [drawCoin]);

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
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frame]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (cx - rect.left) * (W / rect.width), y: (cy - rect.top) * (H / rect.height) };
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    pointerRef.current = pos;
    heldRef.current = true;
    spawnAccRef.current = 0;
    spawnCoin(pos.x, pos.y); // one right away
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!heldRef.current) return;
    e.preventDefault();
    pointerRef.current = getPos(e);
  };
  const onUp = () => {
    heldRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ cursor: 'pointer', touchAction: 'none' }}
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// soft background-tinted fog at the left/right edges so the arm blurs in and out
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

// cupped open hand (fingers curl up into a cradle, thumb on the near side), opening upward.
// drawn as a merged silhouette: outline-colored parts (grown) first, white parts on top,
// so only the outer edge shows and there are no internal seams.
function drawCatchHand(ctx: CanvasRenderingContext2D, hx: number, hy: number) {
  const capsules: [number, number, number, number, number][] = [
    [hx + 2, hy - 1, hx + 8, hy - 14, 6],
    [hx + 10, hy - 3, hx + 13, hy - 19, 6.5],
    [hx + 18, hy - 3, hx + 19, hy - 18, 6.5],
    [hx + 26, hy - 1, hx + 23, hy - 13, 6],
    [hx - 4, hy + 4, hx - 15, hy - 6, 7], // thumb, near side
  ];
  const palm: [number, number, number, number] = [hx + 9, hy + 5, 20, 10];

  const parts = (color: string, grow: number) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(palm[0], palm[1], palm[2] + grow, palm[3] + grow, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const c of capsules) {
      ctx.lineWidth = c[4] + grow * 2;
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[2], c[3]);
      ctx.stroke();
    }
  };

  ctx.save();
  parts(ARM, 2.4);
  parts(GLOVE, 0);
  ctx.restore();
}

export default HandCoins;
