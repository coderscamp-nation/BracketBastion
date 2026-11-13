// ─────────────────────────────────────────────────────────────
//  BRACKET BASTION — canvas renderer (blueprint / schematic look)
//  World space is in cell units; in portrait the grid is transposed
//  so the path runs top→bottom and tiles stay thumb-sized.
// ─────────────────────────────────────────────────────────────
import { COLS, ENEMIES, ROWS, STAGES, TOWERS, getLayout, type Layout, type StageTheme, type TowerType } from './config';
import type { Banner, Engine, Enemy, Tower } from './engine';

const TAU = Math.PI * 2;
export const MONO = '"Share Tech Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
export const STENCIL = '"Saira Stencil One", "Saira Condensed", Impact, "Arial Narrow", sans-serif';
export const COND = '"Saira Condensed", "Arial Narrow", system-ui, sans-serif';

const INK = '#eaf4ff';
/** Plate colour behind towers and collectors — follows the current stage theme. */
let PLATE = STAGES[0].theme.plate;
const MINT = '#5dffa8';
const GOLD = '#ffd23f';
const RED = '#ff5a4a';
const PINK = '#ff7bd5';

const easeOutBack = (k: number) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Ctx = CanvasRenderingContext2D;

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx: Ctx, x: number, y: number, r: number, n: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

/** Schematic tower symbol. Shared by the board and the DOM build-bar icons. */
export function drawTowerGlyph(
  ctx: Ctx,
  type: TowerType,
  x: number,
  y: number,
  s: number,
  level = 0,
  time = 0,
  aim = -Math.PI / 4,
  pulse = 0,
  charge = 1,
  plate: string = PLATE,
) {
  const col = TOWERS[type].color;
  const base = ctx.globalAlpha;
  const h = s * 0.4;
  const lw = Math.max(1.25, s * 0.04);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // footprint plate
  rrect(ctx, x - h, y - h, h * 2, h * 2, s * 0.07);
  ctx.fillStyle = plate;
  ctx.fill();
  ctx.globalAlpha = base * (0.13 + pulse * 0.32);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.globalAlpha = base;
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.stroke();
  if (level >= 2) {
    rrect(ctx, x - h + lw * 1.8, y - h + lw * 1.8, (h - lw * 1.8) * 2, (h - lw * 1.8) * 2, s * 0.04);
    ctx.globalAlpha = base * 0.55;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = base;
    ctx.lineWidth = lw;
  }

  switch (type) {
    case 'ctc': {
      const bx = Math.cos(aim);
      const by = Math.sin(aim);
      const px = -by;
      const py = bx;
      // ears — it's a teddy-bear turret, obviously
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      for (const sg of [-1, 1]) {
        circle(ctx, x - bx * s * 0.11 + px * sg * s * 0.17, y - by * s * 0.11 + py * sg * s * 0.17, s * 0.075);
        ctx.fillStyle = plate;
        ctx.fill();
        ctx.stroke();
      }
      // barrel
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.085;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(x + bx * s * 0.12, y + by * s * 0.12);
      ctx.lineTo(x + bx * s * (0.36 - pulse * 0.05), y + by * s * (0.36 - pulse * 0.05));
      ctx.stroke();
      ctx.lineCap = 'round';
      // head
      circle(ctx, x, y, s * 0.19);
      ctx.fillStyle = plate;
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
      circle(ctx, x + bx * s * 0.05, y + by * s * 0.05, s * 0.05);
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case 'ev': {
      poly(ctx, x, y, s * 0.29, 6, Math.PI / 6);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.globalAlpha = base * 0.55;
      ctx.stroke();
      ctx.globalAlpha = base;
      // charge arc
      ctx.beginPath();
      ctx.arc(x, y, s * 0.29, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(charge));
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 1.2;
      ctx.stroke();
      // bolt
      const k = s * (1 + pulse * 0.25);
      ctx.beginPath();
      ctx.moveTo(x + k * 0.05, y - k * 0.2);
      ctx.lineTo(x - k * 0.11, y + k * 0.03);
      ctx.lineTo(x - k * 0.015, y + k * 0.03);
      ctx.lineTo(x - k * 0.06, y + k * 0.2);
      ctx.lineTo(x + k * 0.11, y - k * 0.04);
      ctx.lineTo(x + k * 0.015, y - k * 0.04);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      break;
    }
    case 'silo': {
      circle(ctx, x, y, s * 0.31);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.globalAlpha = base * 0.45;
      ctx.stroke();
      ctx.globalAlpha = base;
      ctx.beginPath();
      ctx.arc(x, y, s * 0.31, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(charge));
      ctx.lineWidth = lw * 1.3;
      ctx.stroke();
      circle(ctx, x, y, s * (0.245 - pulse * 0.03));
      ctx.lineWidth = Math.max(1, lw * 0.7);
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `${Math.max(7, s * 0.165)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('401k', x, y + s * 0.012);
      break;
    }
    case 'hsa': {
      circle(ctx, x, y, s * 0.3);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
      const sc = 1 + Math.sin(time * 4) * 0.05 + pulse * 0.2;
      const a = s * 0.065 * sc;
      const b = s * 0.19 * sc;
      ctx.beginPath();
      ctx.moveTo(x - a, y - b);
      ctx.lineTo(x + a, y - b);
      ctx.lineTo(x + a, y - a);
      ctx.lineTo(x + b, y - a);
      ctx.lineTo(x + b, y + a);
      ctx.lineTo(x + a, y + a);
      ctx.lineTo(x + a, y + b);
      ctx.lineTo(x - a, y + b);
      ctx.lineTo(x - a, y + a);
      ctx.lineTo(x - b, y + a);
      ctx.lineTo(x - b, y - a);
      ctx.lineTo(x - a, y - a);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.globalAlpha = base * 0.35;
      ctx.fill();
      ctx.globalAlpha = base;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, lw * 0.8);
      ctx.stroke();
      break;
    }
    case 'charity': {
      ctx.setLineDash([s * 0.09, s * 0.07]);
      ctx.lineDashOffset = -time * s * 0.35;
      circle(ctx, x, y, s * 0.3);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.setLineDash([]);
      const k = s * 0.15 * (1 + pulse * 0.3);
      const hy = y + s * 0.01;
      ctx.beginPath();
      ctx.moveTo(x, hy + k * 0.95);
      ctx.bezierCurveTo(x - k * 1.5, hy - k * 0.05, x - k * 0.75, hy - k * 1.15, x, hy - k * 0.35);
      ctx.bezierCurveTo(x + k * 0.75, hy - k * 1.15, x + k * 1.5, hy - k * 0.05, x, hy + k * 0.95);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.globalAlpha = base * 0.4;
      ctx.fill();
      ctx.globalAlpha = base;
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, lw * 0.8);
      ctx.stroke();
      break;
    }
  }

  // level pips
  ctx.fillStyle = col;
  const ps = s * 0.07;
  for (let i = 0; i <= level; i++) ctx.fillRect(x - h + s * 0.055 + i * ps * 1.5, y + h - s * 0.055 - ps, ps, ps);
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  w = 0;
  h = 0;
  dpr = 1;
  cell = 40;
  ox = 0;
  oy = 0;
  portrait = false;
  shakeScale = 1;
  private bg: HTMLCanvasElement;
  private stage = 0;
  private layout: Layout = getLayout(0);
  private theme: StageTheme = STAGES[0].theme;
  private deep = '4,21,56';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.bg = document.createElement('canvas');
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.shakeScale = 0.25;
    } catch {
      /* ignore */
    }
  }

  // world (cell units) → screen px
  X(lx: number, ly: number) {
    return this.ox + (this.portrait ? ly : lx) * this.cell;
  }
  Y(lx: number, ly: number) {
    return this.oy + (this.portrait ? lx : ly) * this.cell;
  }

  resize(w: number, h: number) {
    if (w < 20 || h < 20) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const pad = w > 700 ? 14 : 5;
    const cl = Math.min((w - pad * 2) / COLS, (h - pad * 2) / ROWS);
    const cp = Math.min((w - pad * 2) / ROWS, (h - pad * 2) / COLS);
    this.portrait = cp > cl;
    this.cell = Math.max(12, Math.min(112, Math.floor(Math.max(cl, cp) * this.dpr) / this.dpr));
    const gw = (this.portrait ? ROWS : COLS) * this.cell;
    const gh = (this.portrait ? COLS : ROWS) * this.cell;
    this.ox = Math.round((w - gw) / 2);
    this.oy = Math.round((h - gh) / 2);
    this.paintBg();
  }

  repaint() {
    if (this.w) this.paintBg();
  }

  /** Swap layout + colour scheme. Called automatically when the engine changes stage. */
  private setStage(stage: number) {
    this.stage = stage;
    this.layout = getLayout(stage);
    this.theme = STAGES[stage].theme;
    this.deep = this.theme.deep.split(' ').join(',');
    PLATE = this.theme.plate;
    if (this.w) this.paintBg();
  }

  cellAt(clientX: number, clientY: number): { cx: number; cy: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const gx = Math.floor((clientX - r.left - this.ox) / this.cell);
    const gy = Math.floor((clientY - r.top - this.oy) / this.cell);
    const cx = this.portrait ? gy : gx;
    const cy = this.portrait ? gx : gy;
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
    return { cx, cy };
  }

  // ── static blueprint layer ──────────────────────────────────
  private paintBg() {
    const { w, h, dpr, cell, ox, oy } = this;
    const b = this.bg;
    b.width = this.canvas.width;
    b.height = this.canvas.height;
    const c = b.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gw = (this.portrait ? ROWS : COLS) * cell;
    const gh = (this.portrait ? COLS : ROWS) * cell;

    const grad = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, this.theme.glow);
    grad.addColorStop(1, this.theme.paper);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    const lines = (step: number, style: string) => {
      c.strokeStyle = style;
      c.lineWidth = 1;
      c.beginPath();
      for (let x = ox - Math.ceil(ox / step) * step; x <= w; x += step) {
        const px = Math.round(x) + 0.5;
        c.moveTo(px, 0);
        c.lineTo(px, h);
      }
      for (let y = oy - Math.ceil(oy / step) * step; y <= h; y += step) {
        const py = Math.round(y) + 0.5;
        c.moveTo(0, py);
        c.lineTo(w, py);
      }
      c.stroke();
    };
    if (cell >= 28) lines(cell / 4, `rgba(${this.theme.line},0.045)`);
    lines(cell, `rgba(${this.theme.line},0.15)`);

    // sheet frame + registration marks
    c.strokeStyle = 'rgba(234,244,255,0.6)';
    c.lineWidth = 1.5;
    c.strokeRect(ox + 0.5, oy + 0.5, gw - 1, gh - 1);
    c.lineWidth = 1;
    const m = Math.min(10, cell * 0.2);
    for (const [px, py] of [
      [ox, oy],
      [ox + gw, oy],
      [ox, oy + gh],
      [ox + gw, oy + gh],
    ]) {
      c.beginPath();
      c.moveTo(px - m, py);
      c.lineTo(px + m, py);
      c.moveTo(px, py - m);
      c.lineTo(px, py + m);
      c.stroke();
    }

    // edge coordinates (only when there is a margin to put them in)
    c.fillStyle = 'rgba(234,244,255,0.5)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `10px ${MONO}`;
    const sc = this.portrait ? ROWS : COLS;
    const sr = this.portrait ? COLS : ROWS;
    if (oy >= 13) for (let i = 0; i < sc; i++) c.fillText(String.fromCharCode(65 + i), ox + (i + 0.5) * cell, oy - 7);
    if (ox >= 13) for (let i = 0; i < sr; i++) c.fillText(String(i + 1), ox - 7, oy + (i + 0.5) * cell);
    if (oy >= 13 && gw > 420) {
      c.textAlign = 'right';
      c.fillStyle = 'rgba(234,244,255,0.38)';
      c.fillText('DWG 1040-BB · ANNUAL EARNINGS CASTLE · DEFENSIVE PLAN · SCALE 1:1', ox + gw, oy + gh + 8);
      c.textAlign = 'center';
    }

    // the lanes: double-walled channels with a dashed centreline
    const lanes = this.layout.paths.map((p) => p.pts.map(([px, py]) => [this.X(px + 0.5, py + 0.5), this.Y(px + 0.5, py + 0.5)] as const));
    const trace = (pts: ReadonlyArray<readonly [number, number]>) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    };
    c.save();
    c.beginPath();
    c.rect(ox - cell, oy - cell, gw + cell * 2, gh + cell * 2);
    c.clip();
    c.lineJoin = 'miter';
    c.lineCap = 'butt';
    const pw = cell * 0.78;
    // all walls first, then all floors — so crossings and merges open into each other
    c.strokeStyle = 'rgba(234,244,255,0.9)';
    c.lineWidth = pw;
    for (const pts of lanes) {
      trace(pts);
      c.stroke();
    }
    c.strokeStyle = this.theme.path;
    c.lineWidth = pw - Math.max(3, cell * 0.07);
    for (const pts of lanes) {
      trace(pts);
      c.stroke();
    }

    // centreline + flow chevrons, once per unique segment (lanes may share a trunk)
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const a = cell * 0.11;
    const seen = new Set<string>();
    for (const pts of lanes) {
      let entry = true;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const key = `${Math.round(x0)},${Math.round(y0)},${Math.round(x1)},${Math.round(y1)}`;
        const dup = seen.has(key);
        seen.add(key);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const ux = (x1 - x0) / len;
        const uy = (y1 - y0) / len;
        if (!dup) {
          c.setLineDash([cell * 0.14, cell * 0.14]);
          c.strokeStyle = 'rgba(234,244,255,0.22)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x0, y0);
          c.lineTo(x1, y1);
          c.stroke();
          c.setLineDash([]);
        }
        c.lineWidth = Math.max(1.25, cell * 0.03);
        const steps = Math.round(len / cell);
        for (let k = 1; k < steps; k++) {
          const first = entry;
          entry = false;
          if (dup) continue;
          const px = x0 + ux * cell * k;
          const py = y0 + uy * cell * k;
          c.strokeStyle = first ? RED : 'rgba(234,244,255,0.3)';
          const reps = first ? 2 : 1;
          for (let r = 0; r < reps; r++) {
            const qx = px + ux * a * 1.3 * r;
            const qy = py + uy * a * 1.3 * r;
            c.beginPath();
            c.moveTo(qx - ux * a - uy * a, qy - uy * a + ux * a);
            c.lineTo(qx, qy);
            c.lineTo(qx - ux * a + uy * a, qy - uy * a - ux * a);
            c.stroke();
          }
        }
      }
    }
    c.restore();
  }

  // ── frame ───────────────────────────────────────────────────
  draw(g: Engine, time: number) {
    if (g.stage !== this.stage) this.setStage(g.stage);
    if (!this.w) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const cell = this.cell;

    let sx = 0;
    let sy = 0;
    if (g.shake > 0.01) {
      const m = g.shake * cell * 0.3 * this.shakeScale;
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (sx || sy) {
      ctx.fillStyle = this.theme.paper;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.drawImage(this.bg, Math.round(sx * dpr), Math.round(sy * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.drawRanges(g, time);
    this.drawDiverts(g, time);
    const ts = g.towers;
    for (let i = 0; i < ts.length; i++) this.drawTower(ts[i], time);
    this.drawCastle(g, time);
    const es = g.enemies;
    for (let i = 0; i < es.length; i++) if (!es[i].dead) this.drawEnemy(es[i], time);
    for (let i = 0; i < es.length; i++) if (!es[i].dead) this.drawEnemyBill(es[i], time);
    this.drawBeams(g, time);
    this.drawParticles(g);
    this.drawFloaters(g);
    this.drawCursor(g, time);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    if (g.hurt > 0.01) {
      const k = g.hurt;
      ctx.fillStyle = `rgba(255,60,50,${(k * 0.16).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.strokeStyle = `rgba(255,70,60,${(k * 0.85).toFixed(3)})`;
      ctx.lineWidth = 6 + k * 14;
      ctx.strokeRect(0, 0, this.w, this.h);
    }
    if (g.banner) this.drawBanner(g.banner);
  }

  // ── pieces ──────────────────────────────────────────────────
  private rangeCircle(x: number, y: number, range: number, col: string, time: number, solid: boolean) {
    const ctx = this.ctx;
    const r = range * this.cell;
    circle(ctx, x, y, r);
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = solid ? 0.85 : 0.7;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -time * 14;
    ctx.stroke();
    ctx.setLineDash([]);
    // radius dimension, like a real drawing
    const ax = Math.cos(-0.5);
    const ay = Math.sin(-0.5);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + ax * this.cell * 0.45, y + ay * this.cell * 0.45);
    ctx.lineTo(x + ax * r, y + ay * r);
    ctx.stroke();
    if (this.cell >= 34) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col;
      ctx.font = `${Math.max(9, this.cell * 0.17)}px ${MONO}`;
      ctx.fillText('R' + range.toFixed(1), x + ax * (r + this.cell * 0.3), y + ay * (r + this.cell * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  private brackets(x: number, y: number, s: number, col: string, lw: number) {
    const ctx = this.ctx;
    const h = s / 2;
    const a = s * 0.22;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(x - h + a, y - h);
    ctx.lineTo(x - h, y - h);
    ctx.lineTo(x - h, y + h);
    ctx.lineTo(x - h + a, y + h);
    ctx.moveTo(x + h - a, y - h);
    ctx.lineTo(x + h, y - h);
    ctx.lineTo(x + h, y + h);
    ctx.lineTo(x + h - a, y + h);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  private drawRanges(g: Engine, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    // HSA auras are always visible: they are area effects
    const ts = g.towers;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.type !== 'hsa') continue;
      const x = this.X(t.cx + 0.5, t.cy + 0.5);
      const y = this.Y(t.cx + 0.5, t.cy + 0.5);
      const r = TOWERS.hsa.levels[t.level].range * c;
      circle(ctx, x, y, r);
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = MINT;
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = MINT;
      ctx.lineWidth = 1;
      ctx.stroke();
      const k = (time * 0.45 + t.id * 0.37) % 1;
      circle(ctx, x, y, r * k);
      ctx.globalAlpha = (1 - k) * 0.4;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const s = g.selected;
    if (s) {
      const def = TOWERS[s.type];
      this.rangeCircle(this.X(s.cx + 0.5, s.cy + 0.5), this.Y(s.cx + 0.5, s.cy + 0.5), def.levels[s.level].range, def.color, time, true);
    }
  }

  private drawDiverts(g: Engine, time: number) {
    const ctx = this.ctx;
    const es = g.enemies;
    for (let i = 0; i < es.length; i++) {
      const d = es[i].divert;
      if (!d) continue;
      const k = d.t / d.dur;
      ctx.globalAlpha = 0.85 * (1 - k * 0.6);
      ctx.strokeStyle = PINK;
      ctx.lineWidth = Math.max(1.5, this.cell * 0.05) * d.w;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 60;
      ctx.beginPath();
      ctx.moveTo(this.X(d.fx, d.fy), this.Y(d.fx, d.fy));
      ctx.quadraticCurveTo(this.X(d.vx, d.vy), this.Y(d.vx, d.vy), this.X(d.tx, d.ty), this.Y(d.tx, d.ty));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  private drawTower(t: Tower, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    const x = this.X(t.cx + 0.5, t.cy + 0.5);
    const y = this.Y(t.cx + 0.5, t.cy + 0.5);
    const aim = Math.atan2(this.Y(t.aimX, t.aimY) - y, this.X(t.aimX, t.aimY) - x);
    const L = TOWERS[t.type].levels[t.level];
    const charge = t.type === 'hsa' || t.type === 'ctc' ? 1 : clamp01(1 - t.cd / L.rate);
    if (t.born < 1) {
      const pop = Math.max(0.05, easeOutBack(t.born));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      drawTowerGlyph(ctx, t.type, 0, 0, c, t.level, time, aim, t.pulse, charge);
      ctx.restore();
    } else {
      drawTowerGlyph(ctx, t.type, x, y, c, t.level, time, aim, t.pulse, charge);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  private drawCastle(g: Engine, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    const x = this.X(this.layout.castleX, this.layout.castleY);
    const y = this.Y(this.layout.castleX, this.layout.castleY);
    const hit = g.castleHit;
    const wall = hit > 0.05 ? RED : INK;
    const lw = Math.max(1.5, c * 0.045);

    ctx.save();
    ctx.translate(x, y);
    if (this.portrait) ctx.rotate(Math.PI / 2); // plan is symmetric, so a turn equals the transpose

    // shield envelope
    if (g.shield > 0) {
      ctx.strokeStyle = MINT;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = time * 12;
      rrect(ctx, -0.53 * c, -1.49 * c, 1.06 * c, 2.98 * c, c * 0.2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // curtain wall
    ctx.fillStyle = PLATE;
    ctx.strokeStyle = wall;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.rect(-0.34 * c, -1.3 * c, 0.7 * c, 2.6 * c);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(-0.23 * c, -1.19 * c, 0.48 * c, 2.38 * c);
    ctx.globalAlpha = 1;

    // battlements on the wall that faces the collectors
    ctx.fillStyle = wall;
    for (let k = -1.05; k <= 1.06; k += 0.21) {
      if (Math.abs(k) < 0.5) continue;
      ctx.fillRect(-0.34 * c - c * 0.08, k * c - c * 0.045, c * 0.08, c * 0.09);
    }

    // gate opening with gold portcullis ticks
    ctx.fillStyle = this.theme.path;
    ctx.fillRect(-0.34 * c - lw, -0.26 * c, lw * 2, 0.52 * c);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, c * 0.04);
    ctx.beginPath();
    for (const k of [-0.16, 0, 0.16]) {
      ctx.moveTo(-0.43 * c, k * c);
      ctx.lineTo(-0.26 * c, k * c);
    }
    ctx.stroke();

    // towers
    ctx.strokeStyle = wall;
    ctx.lineWidth = lw;
    ctx.fillStyle = PLATE;
    for (const [tx, ty] of [
      [-0.34, -1.3],
      [0.36, -1.3],
      [-0.34, 1.3],
      [0.36, 1.3],
      [-0.34, -0.42],
      [-0.34, 0.42],
    ]) {
      circle(ctx, tx * c, ty * c, c * 0.15);
      ctx.fill();
      ctx.stroke();
      circle(ctx, tx * c, ty * c, c * 0.06);
      ctx.stroke();
    }

    // keep
    poly(ctx, 0.02 * c, 0, c * 0.3, 4, 0);
    ctx.fillStyle = hit > 0.05 ? 'rgba(255,90,74,0.35)' : 'rgba(255,210,63,0.14)';
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.25, c * 0.035);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = GOLD;
    ctx.font = `${Math.max(9, c * 0.3)}px ${MONO}`;
    const off = this.portrait ? 0 : 0.02 * c;
    ctx.fillText('$', x + off, y + (this.portrait ? 0.02 * c : 0) + 1);
  }

  private drawEnemy(e: Enemy, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    const d = ENEMIES[e.type];
    const x = this.X(e.x, e.y);
    let y = this.Y(e.x, e.y);
    let r = d.size * c;
    let alpha = Math.min(1, e.age * 5);
    if (e.divert) {
      const k = e.divert.t / e.divert.dur;
      r *= 1 - 0.5 * Math.sin(k * Math.PI);
      alpha *= 0.8;
    }
    y += Math.sin(time * 9 + e.phase) * r * 0.1;

    ctx.globalAlpha = alpha;
    const lw = Math.max(1.5, c * 0.045);
    ctx.lineWidth = lw;
    ctx.strokeStyle = d.color;
    const f = e.flash;
    const body = f > 0.04 ? `rgba(${(4 + 251 * f) | 0},${(16 + 239 * f) | 0},${(44 + 211 * f) | 0},0.95)` : PLATE;
    ctx.fillStyle = body;

    switch (e.type) {
      case 'fica': {
        // briefcase
        ctx.strokeRect(x - r * 0.4, y - r * 1.08, r * 0.8, r * 0.45);
        rrect(ctx, x - r, y - r * 0.72, r * 2, r * 1.5, r * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.08);
        ctx.lineTo(x + r, y - r * 0.08);
        ctx.stroke();
        ctx.fillStyle = d.color;
        ctx.fillRect(x - r * 0.16, y - r * 0.24, r * 0.32, r * 0.32);
        break;
      }
      case 'state': {
        const sx = this.portrait ? e.dy : e.dx;
        const sy = this.portrait ? e.dx : e.dy;
        poly(ctx, x, y, r * 1.3, 3, Math.atan2(sy, sx));
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'fed': {
        poly(ctx, x, y, r * 1.12, 6, Math.PI / 6);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'med': {
        const a = r * 0.42;
        const b = r * 1.1;
        ctx.beginPath();
        ctx.moveTo(x - a, y - b);
        ctx.lineTo(x + a, y - b);
        ctx.lineTo(x + a, y - a);
        ctx.lineTo(x + b, y - a);
        ctx.lineTo(x + b, y + a);
        ctx.lineTo(x + a, y + a);
        ctx.lineTo(x + a, y + b);
        ctx.lineTo(x - a, y + b);
        ctx.lineTo(x - a, y + a);
        ctx.lineTo(x - b, y + a);
        ctx.lineTo(x - b, y - a);
        ctx.lineTo(x - a, y - a);
        ctx.closePath();
        ctx.fillStyle = f > 0.04 ? body : 'rgba(150,30,60,0.92)';
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'top': {
        poly(ctx, x, y, r * 1.3, 4, 0);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.6;
        poly(ctx, x, y, r * 1.02, 4, 0);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        break;
      }
      case 'boss': {
        ctx.setLineDash([c * 0.12, c * 0.1]);
        ctx.lineDashOffset = time * c * 0.5;
        ctx.lineWidth = 1.5;
        circle(ctx, x, y, r * 1.5);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = lw * 1.3;
        poly(ctx, x, y, r * 1.18, 8, Math.PI / 8);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1;
        poly(ctx, x, y, r * 0.95, 8, Math.PI / 8);
        ctx.stroke();
        break;
      }
      case 'est':
      case 'gift': {
        poly(ctx, x, y, r * 1.15, 5, Math.PI / 5);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'amt': {
        ctx.globalAlpha = alpha * 0.75;
        poly(ctx, x, y, r * 1.05, 3, time * 0.8);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        poly(ctx, x, y, r * 0.82, 3, time * 0.8 + 0.3);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'levy': {
        poly(ctx, x, y, r * 1.25, 6, 0);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = lw * 1.4;
        ctx.strokeRect(x - r * 0.55, y - r * 0.2, r * 1.1, r * 0.4);
        break;
      }
    }

    if (e.freeze > 0) {
      ctx.strokeStyle = 'rgba(93,255,168,0.75)';
      ctx.lineWidth = Math.max(1, c * 0.035);
      circle(ctx, x, y, r * 1.65);
      ctx.stroke();
    }

    if (d.tag) {
      ctx.fillStyle = f > 0.4 ? '#04173f' : d.color;
      ctx.font = `${Math.max(8, r * (e.type === 'boss' ? 0.7 : 0.82))}px ${MONO}`;
      ctx.fillText(d.tag, x, y + 1);
    }

    // remaining-bill ring (countdown) — skipped for swarmlings to keep them light
    const rr = r * (e.type === 'boss' ? 1.72 : 1.55);
    if (e.type !== 'state') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, c * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(e.shown / e.maxHp));
      ctx.stroke();
    }
    if (e.slowF < 0.9) {
      ctx.strokeStyle = MINT;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 4]);
      circle(ctx, x, y, rr + c * 0.07);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  }

  /** The count-down bill above each collector. Drawn in its own pass so queues stay readable. */
  private drawEnemyBill(e: Enemy, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    const d = ENEMIES[e.type];
    const x = this.X(e.x, e.y);
    let r = d.size * c;
    if (e.divert) r *= 1 - 0.5 * Math.sin((e.divert.t / e.divert.dur) * Math.PI);
    const y = this.Y(e.x, e.y) + Math.sin(time * 9 + e.phase) * r * 0.1;
    const rr = r * (e.type === 'boss' ? 1.72 : 1.55);
    const fs = Math.max(9, c * (e.type === 'state' ? 0.17 : e.type === 'boss' ? 0.3 : e.type === 'top' ? 0.25 : 0.2));
    ctx.globalAlpha = Math.min(1, e.age * 5);
    ctx.font = `${fs}px ${MONO}`;
    const label = '$' + Math.ceil(e.shown);
    const ty = y - rr - fs * 0.55;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(4,14,40,0.92)';
    ctx.strokeText(label, x, ty);
    ctx.fillStyle = e.flash > 0.35 ? '#ffffff' : e.type === 'med' ? '#ffc2d1' : INK;
    ctx.fillText(label, x, ty);
    ctx.globalAlpha = 1;
  }

  private drawBeams(g: Engine, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Child Tax Credit: sustained lock-on lasers — thicker and hotter with every level
    const ts = g.towers;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.type !== 'ctc' || !t.beam) continue;
      const col = TOWERS.ctc.color;
      const bw = 1 + t.level * 0.65;
      const x0 = this.X(t.cx + 0.5, t.cy + 0.5);
      const y0 = this.Y(t.cx + 0.5, t.cy + 0.5);
      const x1 = this.X(t.aimX, t.aimY);
      const y1 = this.Y(t.aimX, t.aimY);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const mx = x0 + ((x1 - x0) / len) * c * 0.36;
      const my = y0 + ((y1 - y0) / len) * c * 0.36;
      const fl = 0.7 + 0.3 * Math.sin(time * 55 + t.id * 1.7);
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.28 * fl;
      ctx.lineWidth = c * 0.16 * bw;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = Math.max(1.5, c * 0.05 * bw);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, c * 0.02 * bw);
      ctx.setLineDash([c * 0.12, c * 0.2]);
      ctx.lineDashOffset = -time * c * 6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      circle(ctx, x1, y1, c * (0.05 + 0.04 * fl) * (0.6 + 0.4 * bw));
      ctx.fill();
      if (t.level > 0) {
        // muzzle flare ring on upgraded turrets
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.7 * fl;
        ctx.lineWidth = 1.5;
        circle(ctx, x1, y1, c * 0.12 * bw);
        ctx.stroke();
      }
    }

    const bs = g.beams;
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      const bw = b.w;
      const k = b.life / b.max;
      const x1 = this.X(b.x1, b.y1);
      const y1 = this.Y(b.x1, b.y1);
      const x2 = this.X(b.x2, b.y2);
      const y2 = this.Y(b.x2, b.y2);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      if (b.kind === 'zap') {
        const segs = Math.max(3, Math.round(len / (c * 0.28)));
        const amp = c * 0.34 * (0.8 + 0.2 * bw);
        // upgraded arcs fork into extra strands
        const strands = bw > 2 ? 3 : bw > 1.3 ? 2 : 1;
        for (let n = 0; n < strands; n++) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          for (let q = 1; q < segs; q++) {
            const u = q / segs;
            const j = (Math.random() - 0.5) * amp * (n ? 1.7 : 1);
            ctx.lineTo(x1 + dx * u + nx * j, y1 + dy * u + ny * j);
          }
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = b.color;
          if (n === 0) {
            ctx.globalAlpha = 0.35 * k;
            ctx.lineWidth = c * 0.2 * bw;
            ctx.stroke();
          }
          ctx.globalAlpha = n ? 0.7 * k : k;
          ctx.lineWidth = Math.max(1.5, c * 0.06 * (n ? 0.6 : bw));
          ctx.stroke();
          if (n === 0) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, c * 0.02 * bw);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffffff';
        circle(ctx, x2, y2, c * 0.1 * k * (0.5 + 0.5 * bw));
        ctx.fill();
      } else if (b.kind === 'tractor') {
        const w1 = c * 0.24 * bw;
        const w2 = c * 0.07 * bw;
        ctx.beginPath();
        ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
        ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
        ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
        ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
        ctx.closePath();
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.3 * k;
        ctx.fill();
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.9 * k;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.setLineDash([c * 0.1, c * 0.14]);
        ctx.lineDashOffset = -time * c * 5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, c * 0.05 * bw);
        ctx.stroke();
        ctx.setLineDash([]);
        circle(ctx, x1, y1, (c * 0.32 * (1 - k) + c * 0.1) * (0.6 + 0.4 * bw));
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2 * (0.6 + 0.4 * bw);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.3 * k;
        ctx.lineWidth = c * 0.22 * bw;
        ctx.stroke();
        ctx.globalAlpha = k;
        ctx.lineWidth = Math.max(1.5, c * 0.06 * bw);
        ctx.stroke();
        const a = c * 0.17 * (0.6 + k) * (0.6 + 0.4 * bw);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, c * 0.07 * (0.6 + 0.4 * bw));
        ctx.beginPath();
        ctx.moveTo(x1 - a, y1);
        ctx.lineTo(x1 + a, y1);
        ctx.moveTo(x1, y1 - a);
        ctx.lineTo(x1, y1 + a);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticles(g: Engine) {
    const ctx = this.ctx;
    const c = this.cell;
    ctx.globalCompositeOperation = 'lighter';
    const rs = g.rings;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      const k = 1 - r.life / r.max;
      const e = easeOutCubic(k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.w * (1 - k * 0.6));
      circle(ctx, this.X(r.x, r.y), this.Y(r.x, r.y), Math.max(0.5, (r.r0 + (r.r1 - r.r0) * e) * c));
      ctx.stroke();
    }
    const ps = g.particles;
    let last = '';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const k = p.life / p.max;
      const s = Math.max(1.5, p.size * c * (0.5 + k * 0.5));
      if (p.color !== last) {
        ctx.fillStyle = p.color;
        last = p.color;
      }
      ctx.globalAlpha = k < 0.5 ? k * 2 : 1;
      ctx.fillRect(this.X(p.x, p.y) - s / 2, this.Y(p.x, p.y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFloaters(g: Engine) {
    const ctx = this.ctx;
    const c = this.cell;
    const fs = g.floaters;
    ctx.lineJoin = 'round';
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      const k = f.life / f.max;
      const age = f.max - f.life;
      const pop = age < 0.1 ? 0.6 + (age / 0.1) * 0.7 : Math.max(1, 1.3 - (age - 0.1) * 2.5);
      const size = Math.max(f.big ? 12 : 9, f.size * c * pop);
      let x = this.X(f.x, f.y);
      const y = this.Y(f.x, f.y) - f.rise * c * 0.9;
      ctx.font = `${size.toFixed(1)}px ${f.big ? STENCIL : MONO}`;
      if (f.text.length > 5) {
        const half = f.text.length * size * 0.3;
        if (x < half + 2) x = half + 2;
        else if (x > this.w - half - 2) x = this.w - half - 2;
      }
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(4,14,40,0.85)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawCursor(g: Engine, time: number) {
    const ctx = this.ctx;
    const c = this.cell;
    const sel = g.selected;
    if (sel) {
      this.brackets(this.X(sel.cx + 0.5, sel.cy + 0.5), this.Y(sel.cx + 0.5, sel.cy + 0.5), c * (1.02 + Math.sin(time * 6) * 0.03), TOWERS[sel.type].color, 2.5);
    }
    const cur = g.cursor;
    if (!cur.show || g.result || g.attract) return;
    const x = this.X(cur.cx + 0.5, cur.cy + 0.5);
    const y = this.Y(cur.cx + 0.5, cur.cy + 0.5);
    const tw = g.towerAt(cur.cx, cur.cy);
    let col = INK;
    if (!tw && !sel && g.buildType) {
      const def = TOWERS[g.buildType];
      const L = def.levels[0];
      if (g.canBuild(cur.cx, cur.cy)) {
        const afford = g.gold >= L.cost;
        col = afford ? def.color : RED;
        this.rangeCircle(x, y, L.range, col, time, false);
        ctx.globalAlpha = afford ? 0.6 : 0.3;
        drawTowerGlyph(ctx, g.buildType, x, y, c, 0, time);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!afford) {
          ctx.font = `${Math.max(10, c * 0.22)}px ${MONO}`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(4,14,40,0.9)';
          ctx.strokeText(`$${L.cost}`, x, y);
          ctx.fillStyle = RED;
          ctx.fillText(`$${L.cost}`, x, y);
        }
      } else {
        col = RED;
        ctx.strokeStyle = RED;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        const a = c * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - a, y - a);
        ctx.lineTo(x + a, y + a);
        ctx.moveTo(x + a, y - a);
        ctx.lineTo(x - a, y + a);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else if (tw) {
      col = TOWERS[tw.type].color;
    }
    this.brackets(x, y, c * (0.98 + Math.sin(time * 7) * 0.04), col, 2.5);
  }

  private fit(text: string, size: number, family: string, maxW: number): number {
    const ctx = this.ctx;
    ctx.font = `${size}px ${family}`;
    const tw = ctx.measureText(text).width;
    if (tw > maxW) {
      size *= maxW / tw;
      ctx.font = `${size}px ${family}`;
    }
    return size;
  }

  private drawBanner(b: Banner) {
    const ctx = this.ctx;
    const W = this.w;
    const H = this.h;
    const tin = clamp01(b.t / 0.32);
    const tout = clamp01((b.t - (b.dur - 0.35)) / 0.35);
    const a = easeOutCubic(tin) * (1 - tout);
    if (a <= 0.01) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (b.kind === 'wave') {
      const bh = Math.max(64, Math.min(H * 0.18, 130));
      const cy = Math.round(H * 0.44);
      ctx.globalAlpha = a * 0.88;
      ctx.fillStyle = `rgb(${this.deep})`;
      ctx.fillRect(0, cy - bh / 2, W, bh);
      ctx.globalAlpha = a;
      ctx.fillStyle = INK;
      ctx.fillRect(0, cy - bh / 2, W, 1.5);
      ctx.fillRect(0, cy + bh / 2 - 1.5, W, 1.5);
      ctx.fillStyle = RED;
      ctx.fillRect(0, cy - bh / 2 + 4, W * easeOutCubic(tin), 2);
      ctx.fillRect(W - W * easeOutCubic(tin), cy + bh / 2 - 6, W * easeOutCubic(tin), 2);
      const slide = (1 - easeOutCubic(tin)) * -W * 0.3 + tout * W * 0.3;
      ctx.fillStyle = GOLD;
      this.fit(b.top, Math.max(11, bh * 0.14), MONO, W * 0.9);
      ctx.fillText(b.top, W / 2 - slide, cy - bh * 0.31);
      ctx.fillStyle = INK;
      this.fit(b.title, bh * 0.4, STENCIL, W * 0.92);
      ctx.fillText(b.title, W / 2 + slide, cy + bh * 0.02);
      ctx.fillStyle = 'rgba(234,244,255,0.82)';
      this.fit(b.sub, Math.max(12, bh * 0.15), COND, W * 0.94);
      ctx.fillText(b.sub, W / 2 - slide, cy + bh * 0.33);
    } else {
      const col = b.kind === 'perfect' ? MINT : b.kind === 'lose' ? RED : b.kind === 'win' ? (b.title === 'TOTAL EXEMPTION' ? MINT : GOLD) : INK;
      const punch = 1 + (1 - easeOutBack(tin)) * 1.5;
      ctx.translate(W / 2, H * 0.44);
      ctx.rotate(-0.06);
      ctx.scale(punch, punch);
      ctx.globalAlpha = a;
      const fs = this.fit(b.title, Math.min(H * 0.15, 92), STENCIL, W * 0.78);
      const tw = ctx.measureText(b.title).width;
      const bw = tw + fs * 0.9;
      const bh = fs * 2.3;
      ctx.fillStyle = `rgba(${this.deep},0.86)`;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2.5, fs * 0.075);
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-bw / 2 + fs * 0.13, -bh / 2 + fs * 0.13, bw - fs * 0.26, bh - fs * 0.26);
      ctx.fillStyle = col;
      ctx.fillText(b.title, 0, fs * 0.04);
      this.fit(b.top, Math.max(10, fs * 0.24), MONO, bw * 0.88);
      ctx.fillText(b.top, 0, -bh * 0.33);
      ctx.fillStyle = INK;
      this.fit(b.sub, Math.max(10, fs * 0.24), MONO, bw * 0.88);
      ctx.fillText(b.sub, 0, bh * 0.34);
    }
    ctx.restore();
  }
}
