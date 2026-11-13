// ─────────────────────────────────────────────────────────────
//  BRACKET BASTION — simulation engine (no DOM access; headless-safe)
// ─────────────────────────────────────────────────────────────
import {
  BIG_DEBT,
  BIG_DEBT_RATE,
  BUILD_TIME,
  CHARITY_RESERVE,
  COLS,
  DIFFS,
  ENEMIES,
  FIRST_DELAY,
  killBounty,
  WAVE_HP,
  MAX_DIVERTS,
  ROWS,
  SELL_RATE,
  SHIELD_CAP,
  STAGES,
  START_EARNINGS,
  TOWERS,
  VAULT_RATE,
  getLayout,
  inGrid,
  maxTowerLevel,
  pathPos,
  TEST_UNLOCK_ALL,
  towerStats,
  wavesForStage,
  type CampaignPerk,
  type Difficulty,
  type EnemyType,
  type Layout,
  type PathPoint,
  type TowerType,
} from './config';

export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface Divert {
  t: number;
  dur: number;
  /** beam scale from the channel's level */
  w: number;
  fx: number;
  fy: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  toDist: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  shown: number;
  /** lane index + distance walked + distance left to the gate */
  path: number;
  dist: number;
  left: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  speed: number;
  slowF: number;
  bounty: number;
  /** extra cash paid for writing off a large debt */
  bonus: number;
  flash: number;
  phase: number;
  age: number;
  divert: Divert | null;
  immune: number;
  diverts: number;
  /** seconds left of full stop from tax-shelter perks */
  freeze: number;
  dead: boolean;
}

export interface Tower {
  id: number;
  type: TowerType;
  cx: number;
  cy: number;
  level: number;
  cd: number;
  target: Enemy | null;
  aimX: number;
  aimY: number;
  born: number;
  pulse: number;
  spent: number;
  tally: number;
  beam: boolean;
}

export interface Beam {
  kind: 'zap' | 'tractor' | 'heal';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  max: number;
  /** visual scale — grows with the tower's level */
  w: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  drag: number;
}

export interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  w: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  rise: number;
  big: boolean;
}

export interface Banner {
  kind: 'wave' | 'perfect' | 'clear' | 'win' | 'lose';
  top: string;
  title: string;
  sub: string;
  t: number;
  dur: number;
}

export interface ResultLine {
  label: string;
  value: number;
  note?: string;
}

export interface Result {
  won: boolean;
  perfect: boolean;
  score: number;
  wave: number;
  bill: number;
  lines: ResultLine[];
  /** 0-based stage index, total stages, and whether this was the last one */
  stage: number;
  stages: number;
  final: boolean;
  diff: Difficulty;
}

export interface HudSel {
  id: number;
  type: TowerType;
  level: number;
  upCost: number | null;
  sell: number;
  stats: { k: string; v: string }[];
  next: { k: string; v: string }[] | null;
  tally: number;
}

export interface Hud {
  gold: number;
  earnings: number;
  maxEarnings: number;
  shield: number;
  vault: number;
  score: number;
  bill: number;
  wave: number;
  waves: number;
  phase: Phase;
  countdown: number;
  left: number;
  name: string;
  tip: string;
  buildType: TowerType | null;
  sel: HudSel | null;
  built: number;
  /** 1-based */
  stage: number;
  stageName: string;
  diff: Difficulty;
  maxTowerLevel: number;
  campaignPerks: CampaignPerk[];
}

const TAU = Math.PI * 2;
const rnd = Math.random;
const P: PathPoint = { x: 0, y: 0, dx: 1, dy: 0 };

const INK = '#eaf4ff';
const MINT = '#5dffa8';
const GOLD = '#ffd23f';
const RED = '#ff5a4a';
const PINK = '#ff7bd5';
const LIME = '#c8ff4a';
const CYAN = '#4ee8ff';
const GREY = '#9db6de';

const FIREWORKS = [
  [MINT, INK, CYAN],
  [GOLD, INK, MINT],
  [PINK, INK, GOLD],
  [CYAN, INK, LIME],
];

/** Demo build for the title screen: placed automatically on whichever stage is showing. */
const ATTRACT: [TowerType, number][] = [
  ['ctc', 1],
  ['ev', 1],
  ['hsa', 0],
  ['silo', 1],
  ['ctc', 2],
  ['charity', 0],
  ['ctc', 1],
  ['ev', 0],
  ['silo', 0],
  ['ctc', 0],
  ['ctc', 1],
];

const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);

export class Engine {
  gold = 0;
  earnings = 0;
  maxEarnings = 0;
  shield = 0;
  vault = 0;
  vpExempt = 0;
  vpWave = 0;
  vpCharity = 0;

  waveIndex = -1;
  phase: Phase = 'build';
  countdown = 0;
  waveTime = 0;
  waveBill = 0;
  totalBill = 0;
  perfectWaves = 0;
  exempted = 0;
  /** cash earned from large-debt bonuses this stage */
  bonusGold = 0;
  diverted = 0;
  donated = 0;
  time = 0;
  endTime = 0;
  attract = false;
  stage = 0;
  diff: Difficulty = 'normal';
  layout: Layout = getLayout(0);
  /** score carried in from earlier stages of the same campaign */
  carry = 0;
  campaignPerks: CampaignPerk[] = [];

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  grid: (Tower | null)[] = [];
  queue: { t: number; type: EnemyType }[] = [];

  beams: Beam[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  floaters: Floater[] = [];
  banner: Banner | null = null;

  shake = 0;
  castleHit = 0;
  hurt = 0;
  goldFlash = 0;

  buildType: TowerType | null = 'ctc';
  selected: Tower | null = null;
  cursor = { cx: 4, cy: 3, show: false };
  built = 0;
  result: Result | null = null;

  sfx: (name: string) => void = () => {};
  onEnd: (r: Result) => void = () => {};
  /** Fired after each wave is cleared (1-based wave number, total in stage). */
  onWaveCleared: (waveNumber: number, totalWaves: number) => void = () => {};

  private nextId = 1;
  private spawnN = 0;
  private slowmo = 0;
  private fwTimer = 0;
  private shelterPulse = 0;
  private wildcardTimer = 14;
  private hits: Enemy[] = [];

  private get waves() {
    return wavesForStage(this.stage);
  }

  constructor() {
    this.reset(false);
  }

  get score() {
    return this.carry + Math.round((this.vpExempt + this.vpWave + this.vpCharity) * DIFFS[this.diff].score);
  }

  // ── lifecycle ───────────────────────────────────────────────
  reset(attract = false, stage = 0, carry = 0, diff: Difficulty = 'normal', perks: CampaignPerk[] = []) {
    this.diff = attract ? 'normal' : diff;
    this.attract = attract;
    this.stage = Math.max(0, Math.min(STAGES.length - 1, stage));
    this.campaignPerks = attract ? [] : perks;
    this.layout = getLayout(this.stage);
    this.carry = attract ? 0 : carry;
    this.spawnN = 0;
    this.gold = attract ? 99999 : STAGES[this.stage].gold + DIFFS[this.diff].gold + (TEST_UNLOCK_ALL ? 8000 : 0);
    this.earnings = START_EARNINGS;
    this.maxEarnings = START_EARNINGS;
    this.shield = 0;
    this.vault = 0;
    this.vpExempt = 0;
    this.vpWave = 0;
    this.vpCharity = 0;
    this.waveIndex = -1;
    this.phase = 'build';
    this.countdown = attract ? 0.4 : FIRST_DELAY;
    this.waveTime = 0;
    this.waveBill = 0;
    this.totalBill = 0;
    this.perfectWaves = 0;
    this.exempted = 0;
    this.bonusGold = 0;
    this.diverted = 0;
    this.donated = 0;
    this.time = 0;
    this.endTime = 0;
    this.fwTimer = 0;
    this.shelterPulse = 5.5;
    this.wildcardTimer = 12 + rnd() * 8;
    this.slowmo = 0;
    this.enemies.length = 0;
    this.towers.length = 0;
    this.queue.length = 0;
    this.beams.length = 0;
    this.particles.length = 0;
    this.rings.length = 0;
    this.floaters.length = 0;
    this.grid = new Array(COLS * ROWS).fill(null);
    this.banner = null;
    this.shake = 0;
    this.castleHit = 0;
    this.hurt = 0;
    this.goldFlash = 0;
    this.buildType = 'ctc';
    this.selected = null;
    this.cursor = { cx: 4, cy: 3, show: false };
    this.built = 0;
    this.result = null;
    if (attract) {
      for (const [type, lv] of ATTRACT) {
        const c = this.bestCell(type, lv);
        if (c) this.place(type, c[0], c[1], lv);
      }
    } else {
      // Everyone gets one free credit — the "standard deduction".
      const [sx, sy] = STAGES[this.stage].starter;
      this.place('ctc', sx, sy, 0);
    }
  }

  // ── queries ─────────────────────────────────────────────────
  towerAt(cx: number, cy: number): Tower | null {
    return inGrid(cx, cy) ? this.grid[cy * COLS + cx] : null;
  }

  canBuild(cx: number, cy: number): boolean {
    return inGrid(cx, cy) && this.layout.kinds[cy * COLS + cx] === 0 && !this.grid[cy * COLS + cx];
  }

  /** Tile with the most path in range for a tower type — used by the title-screen demo and balance bots. */
  bestCell(type: TowerType, level = 0): [number, number] | null {
    const range = TOWERS[type].levels[level].range;
    const r2 = range * range;
    let best: [number, number] | null = null;
    let bv = -1;
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        if (!this.canBuild(cx, cy)) continue;
        let n = 0;
        for (const p of this.layout.paths) {
          for (let d = 0.5; d < p.gate; d += 0.5) {
            pathPos(p, d, P);
            const dx = P.x - (cx + 0.5);
            const dy = P.y - (cy + 0.5);
            if (dx * dx + dy * dy <= r2) n++;
          }
        }
        if (n > bv) {
          bv = n;
          best = [cx, cy];
        }
      }
    }
    return best;
  }

  // ── player actions ──────────────────────────────────────────
  private place(type: TowerType, cx: number, cy: number, level = 0): Tower {
    let spent = 0;
    for (let i = 0; i <= level; i++) spent += TOWERS[type].levels[i].cost;
    const t: Tower = {
      id: this.nextId++,
      type,
      cx,
      cy,
      level,
      cd: 0.25,
      target: null,
      aimX: cx + 1.5,
      aimY: cy - 0.5,
      born: 0,
      pulse: 0,
      spent,
      tally: 0,
      beam: false,
    };
    this.towers.push(t);
    this.grid[cy * COLS + cx] = t;
    return t;
  }

  build(type: TowerType, cx: number, cy: number): boolean {
    if (this.result || this.attract) return false;
    if (!this.canBuild(cx, cy)) {
      if (inGrid(cx, cy)) this.floater(cx + 0.5, cy + 0.4, 'NO BUILD ZONE', RED, 0.2, 0.7);
      this.sfx('deny');
      return false;
    }
    const def = TOWERS[type];
    const cost = def.levels[0].cost;
    if (this.gold < cost) {
      this.floater(cx + 0.5, cy + 0.4, `NEED $${cost}`, RED, 0.24, 0.8);
      this.goldFlash = 1;
      this.sfx('deny');
      return false;
    }
    this.gold -= cost;
    this.place(type, cx, cy, 0);
    this.built++;
    this.ring(cx + 0.5, cy + 0.5, 0.25, def.levels[0].range, def.color, 0.45, 2);
    this.burst(cx + 0.5, cy + 0.5, 12, 3, [def.color, INK], 0.4);
    this.floater(cx + 0.5, cy + 0.1, `-$${cost}`, GOLD, 0.2, 0.7);
    this.sfx('build');
    return true;
  }

  upgrade(t: Tower | null): boolean {
    if (!t || this.result || this.attract) return false;
    const def = TOWERS[t.type];
    const cap = Math.min(def.levels.length - 1, maxTowerLevel(this.stage));
    if (t.level >= cap) {
      if (t.level < def.levels.length - 1) {
        const nextLv = t.level + 2;
        const needStage = nextLv <= 3 ? 1 : nextLv === 4 ? 3 : 5;
        this.floater(t.cx + 0.5, t.cy + 0.4, `LV ${nextLv} · STAGE ${needStage}+`, GREY, 0.22, 1.0);
      }
      this.sfx('deny');
      return false;
    }
    const cost = def.levels[t.level + 1].cost;
    if (this.gold < cost) {
      this.floater(t.cx + 0.5, t.cy + 0.4, `NEED $${cost}`, RED, 0.24, 0.8);
      this.goldFlash = 1;
      this.sfx('deny');
      return false;
    }
    this.gold -= cost;
    t.level++;
    t.spent += cost;
    t.born = 0.35;
    t.pulse = 1;
    this.ring(t.cx + 0.5, t.cy + 0.5, 0.25, def.levels[t.level].range, def.color, 0.5, 3);
    this.burst(t.cx + 0.5, t.cy + 0.5, 18, 3.6, [def.color, INK, GOLD], 0.5);
    this.floater(t.cx + 0.5, t.cy + 0.1, `LEVEL ${t.level + 1}`, def.color, 0.26, 0.9, true);
    this.sfx('upgrade');
    return true;
  }

  sell(t: Tower | null): boolean {
    if (!t || this.result || this.attract) return false;
    const i = this.towers.indexOf(t);
    if (i < 0) return false;
    const refund = Math.round(t.spent * SELL_RATE);
    this.towers.splice(i, 1);
    this.grid[t.cy * COLS + t.cx] = null;
    if (this.selected === t) this.selected = null;
    this.gold += refund;
    this.floater(t.cx + 0.5, t.cy + 0.3, `+$${refund}`, GOLD, 0.24, 0.8);
    this.ring(t.cx + 0.5, t.cy + 0.5, 0.6, 0.1, INK, 0.3, 2);
    this.sfx('sell');
    return true;
  }

  setBuild(type: TowerType) {
    if (this.result || this.attract) return;
    this.buildType = type;
    this.selected = null;
    this.sfx('select');
  }

  tapCell(cx: number, cy: number) {
    if (this.result || this.attract) return;
    const t = this.towerAt(cx, cy);
    if (t) {
      this.selected = this.selected === t ? null : t;
      this.sfx('select');
      return;
    }
    if (this.selected) {
      this.selected = null;
      this.sfx('select');
      return;
    }
    if (this.buildType) this.build(this.buildType, cx, cy);
  }

  moveCursor(dx: number, dy: number) {
    const c = this.cursor;
    if (!c.show) {
      c.show = true;
      return;
    }
    c.cx = Math.max(0, Math.min(COLS - 1, c.cx + dx));
    c.cy = Math.max(0, Math.min(ROWS - 1, c.cy + dy));
  }

  sendWave() {
    if (this.phase !== 'build' || this.result || this.attract) return;
    const bonus = Math.max(0, Math.round(this.countdown * 2));
    if (bonus > 0 && this.waveIndex >= 0) {
      this.gold += bonus;
      this.floater(this.layout.castleX - 0.6, this.layout.castleY - 0.9, `EARLY FILER +$${bonus}`, GOLD, 0.22, 1.1);
    }
    this.startWave();
  }

  // ── simulation ──────────────────────────────────────────────
  step(dt: number) {
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      if (!this.attract) dt *= 0.3;
    }
    this.time += dt;
    if (this.phase === 'won' || this.phase === 'lost') {
      this.endTime += dt;
      this.updateFx(dt);
      return;
    }
    if (this.phase === 'build') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after < before && after > 0 && after <= 3 && this.waveIndex >= 0) this.sfx('tick');
      if (this.countdown <= 0) this.startWave();
    } else {
      this.waveTime += dt;
      const q = this.queue;
      while (q.length && q[q.length - 1].t <= this.waveTime) this.spawn(q.pop()!.type);
    }

    this.updateEnemies(dt);
    if (!this.result) {
      this.updateTowers(dt);
      this.updatePerks(dt);
    }
    this.updateFx(dt);

    const es = this.enemies;
    let w = 0;
    for (let i = 0; i < es.length; i++) if (!es[i].dead) es[w++] = es[i];
    es.length = w;

    if (!this.result && this.phase === 'wave' && this.queue.length === 0 && w === 0) this.waveCleared();
    if (this.attract) {
      this.shake = 0;
      this.hurt = 0;
    }
  }

  private startWave() {
    this.waveIndex++;
    const roster = this.waves;
    const idx = this.attract ? this.waveIndex % 6 : Math.min(this.waveIndex, roster.length - 1);
    const def = roster[idx];
    this.phase = 'wave';
    this.waveTime = 0;
    this.waveBill = 0;
    this.countdown = 0;
    this.queue.length = 0;
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) this.queue.push({ t: (g.delay ?? 0) + i * g.gap + 0.3, type: g.type });
    }
    this.queue.sort((a, b) => b.t - a.t);
    if (!this.attract) {
      const mode = this.diff === 'normal' ? '' : ` · ${DIFFS[this.diff].name} MODE`;
      const top = idx === 0 ? `STAGE ${this.stage + 1} · ${STAGES[this.stage].name}${mode}` : `WAVE ${pad2(idx + 1)} / ${pad2(roster.length)}`;
      const nextPay = 35 + 10 * (idx + 1) + Math.min(this.stage, 8) + 20;
      this.banner = {
        kind: 'wave',
        top,
        title: def.name,
        sub: `Clear for up to +$${nextPay}`,
        t: 0,
        dur: 2.4,
      };
      this.sfx('wave');
    }
  }

  private spawn(type: EnemyType) {
    const d = ENEMIES[type];
    const idx = this.attract ? this.waveIndex % 6 : this.waveIndex;
    const hpMult =
      WAVE_HP[Math.min(idx, WAVE_HP.length - 1)] * STAGES[this.stage].hp * DIFFS[this.diff].hp;
    const hp = Math.round(d.hp * hpMult);
    const bounty = killBounty(d.bounty, hpMult, d.hp);
    // lanes take turns, so multi-lane stages split every wave evenly
    const lane = this.spawnN++ % this.layout.paths.length;
    const path = this.layout.paths[lane];
    pathPos(path, 0, P);
    const jit = type === 'boss' ? 0 : type === 'state' ? 0.16 : 0.09;
    const ox = (rnd() - 0.5) * 2 * jit;
    const oy = (rnd() - 0.5) * 2 * jit;
    this.enemies.push({
      id: this.nextId++,
      type,
      hp,
      maxHp: hp,
      shown: hp,
      path: lane,
      dist: 0,
      left: path.gate,
      x: P.x + ox,
      y: P.y + oy,
      dx: P.dx,
      dy: P.dy,
      ox,
      oy,
      speed: d.speed * STAGES[this.stage].speed * (0.95 + rnd() * 0.1),
      slowF: 1,
      bounty,
      // the bigger the debt, the bigger the finder's fee
      bonus: hp >= BIG_DEBT ? Math.round(hp * BIG_DEBT_RATE) : 0,
      flash: 0,
      phase: rnd() * TAU,
      age: 0,
      divert: null,
      immune: 0,
      diverts: 0,
      freeze: 0,
      dead: false,
    });
  }

  private updatePerks(dt: number) {
    if (this.attract) return;
    if (this.campaignPerks.includes('shelter')) {
      this.shelterPulse -= dt;
      if (this.shelterPulse <= 0) {
        this.shelterPulse = 7.5;
        const ts = this.towers;
        const es = this.enemies;
        let hit = 0;
        for (let i = 0; i < ts.length; i++) {
          const t = ts[i];
          const r = TOWERS[t.type].levels[t.level].range;
          const r2 = r * r;
          const tx = t.cx + 0.5;
          const ty = t.cy + 0.5;
          for (let j = 0; j < es.length; j++) {
            const e = es[j];
            if (e.dead || e.divert) continue;
            const dx = e.x - tx;
            const dy = e.y - ty;
            if (dx * dx + dy * dy > r2) continue;
            if (e.type === 'boss') e.freeze = Math.max(e.freeze, 0.5);
            else e.freeze = Math.max(e.freeze, 1.35);
            hit++;
          }
        }
        if (hit > 0) {
          this.floater(this.layout.castleX - 1, this.layout.castleY - 1.2, 'TAX SHELTER FREEZE', MINT, 0.22, 1.1, true);
          this.ring(this.layout.castleX, this.layout.castleY, 0.3, 2.8, MINT, 0.45, 2);
        }
      }
    }
    if (this.campaignPerks.includes('wildcard')) {
      this.wildcardTimer -= dt;
      if (this.wildcardTimer <= 0) {
        this.wildcardTimer = 10 + rnd() * 14;
        const roll = rnd();
        const x = 2 + rnd() * (COLS - 4);
        const y = 1 + rnd() * (ROWS - 2);
        if (roll < 0.34) {
          const pay = 25 + Math.round(rnd() * 55);
          this.gold += pay;
          this.floater(x, y, `WILDCARD +$${pay}`, GOLD, 0.26, 1.1, true);
          this.burst(x, y, 14, 3.2, [GOLD, INK], 0.45);
        } else if (roll < 0.67) {
          const pts = 8 + Math.round(rnd() * 16);
          this.shield = Math.min(SHIELD_CAP, this.shield + pts);
          this.floater(x, y, `WILDCARD +${pts} SHIELD`, MINT, 0.24, 1.0, true);
          this.ring(x, y, 0.1, 1.2, MINT, 0.4, 2);
        } else {
          const es = this.enemies;
          let n = 0;
          for (let i = 0; i < es.length; i++) {
            const e = es[i];
            if (e.dead || e.divert) continue;
            n += Math.round(this.damage(e, 12 + rnd() * 18, 'credit', CYAN));
          }
          if (n > 0) {
            this.floater(x, y, `AUDIT SURPRISE -$${n}`, CYAN, 0.26, 1.0, true);
            this.shake = Math.max(this.shake, 0.25);
          }
        }
      }
    }
  }

  private updateEnemies(dt: number) {
    const es = this.enemies;
    const ts = this.towers;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead) continue;
      e.age += dt;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
      e.shown += (e.hp - e.shown) * Math.min(1, dt * 14);
      if (e.immune > 0) e.immune -= dt;
      if (e.freeze > 0) {
        e.freeze = Math.max(0, e.freeze - dt);
        e.slowF = 0;
        continue;
      }

      const dv = e.divert;
      if (dv) {
        dv.t += dt;
        const k = Math.min(1, dv.t / dv.dur);
        const u = 1 - k;
        e.x = u * u * dv.fx + 2 * u * k * dv.vx + k * k * dv.tx;
        e.y = u * u * dv.fy + 2 * u * k * dv.vy + k * k * dv.ty;
        if (k >= 1) {
          e.dist = dv.toDist;
          e.left = this.layout.paths[e.path].gate - e.dist;
          e.divert = null;
          e.immune = 5;
          this.ring(e.x, e.y, 0.1, 0.6, PINK, 0.35, 2);
        }
        continue;
      }

      let slow = 0;
      for (let j = 0; j < ts.length; j++) {
        const t = ts[j];
        if (t.type !== 'hsa') continue;
        const L = TOWERS.hsa.levels[t.level];
        const dx = e.x - (t.cx + 0.5);
        const dy = e.y - (t.cy + 0.5);
        if (dx * dx + dy * dy <= L.range * L.range && L.slow! > slow) slow = L.slow!;
      }
      if (this.campaignPerks.includes('shelter')) slow = Math.min(0.92, slow + 0.12);
      if (e.type === 'boss') slow *= 0.5;
      e.slowF += (1 - slow - e.slowF) * Math.min(1, dt * 8);
      e.dist += e.speed * e.slowF * dt;
      const path = this.layout.paths[e.path];
      pathPos(path, e.dist, P);
      e.x = P.x + e.ox;
      e.y = P.y + e.oy;
      e.dx = P.dx;
      e.dy = P.dy;
      e.left = path.gate - e.dist;
      if (e.left <= 0) this.leak(e);
    }
  }

  /** mode 0: closest to the gate (medical bills last). mode 1: best target for a deduction chunk. */
  private pick(tx: number, ty: number, range: number, mode: 0 | 1, chunk = 0): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bv = -1e9;
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.dead || e.divert) continue;
      const dx = e.x - tx;
      const dy = e.y - ty;
      if (dx * dx + dy * dy > r2) continue;
      const v = mode === 0 ? -e.left - (e.type === 'med' ? 1000 : 0) : Math.min(e.hp, chunk * ENEMIES[e.type].ded) * 1000 - e.left;
      if (v > bv) {
        bv = v;
        best = e;
      }
    }
    return best;
  }

  private updateTowers(dt: number) {
    const ts = this.towers;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.born < 1) t.born = Math.min(1, t.born + dt * 3.2);
      if (t.pulse > 0) t.pulse = Math.max(0, t.pulse - dt * 3.5);
      t.cd -= dt;
      const def = TOWERS[t.type];
      const L = def.levels[t.level];
      const tx = t.cx + 0.5;
      const ty = t.cy + 0.5;
      const r2 = L.range * L.range;
      const bw = 1 + t.level * 0.65; // beams get visibly bigger with every upgrade

      switch (t.type) {
        case 'ctc': {
          let e = t.target;
          if (e) {
            const dx = e.x - tx;
            const dy = e.y - ty;
            if (e.dead || e.divert || dx * dx + dy * dy > r2) e = null;
          }
          if (!e) e = this.pick(tx, ty, L.range, 0);
          t.target = e;
          t.beam = !!e;
          if (e) {
            t.aimX = e.x;
            t.aimY = e.y;
            if (t.cd <= 0) {
              t.cd = L.rate;
              t.pulse = 0.5;
              t.tally += this.damage(e, L.dmg!, 'credit', CYAN);
              this.spark(e.x, e.y, CYAN, 2);
              this.sfx('laser');
            }
          }
          break;
        }

        case 'ev': {
          if (t.cd > 0) break;
          const first = this.pick(tx, ty, L.range, 0);
          if (!first) break;
          t.cd = L.rate;
          t.pulse = 1;
          t.aimX = first.x;
          t.aimY = first.y;
          const hits = this.hits;
          hits.length = 0;
          hits.push(first);
          let cur = first;
          const es = this.enemies;
          for (let n = 0; n < L.chain!; n++) {
            let nb: Enemy | null = null;
            let nd = 1.9 * 1.9;
            for (let j = 0; j < es.length; j++) {
              const e = es[j];
              if (e.dead || e.divert || hits.indexOf(e) >= 0) continue;
              const dx = e.x - cur.x;
              const dy = e.y - cur.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < nd) {
                nd = d2;
                nb = e;
              }
            }
            if (!nb) break;
            hits.push(nb);
            cur = nb;
          }
          let px = tx;
          let py = ty;
          let dmg = L.dmg!;
          for (let j = 0; j < hits.length; j++) {
            const e = hits[j];
            this.beam('zap', px, py, e.x, e.y, LIME, 0.22, bw);
            px = e.x;
            py = e.y;
            t.tally += this.damage(e, dmg, 'credit', LIME);
            this.spark(px, py, LIME, 4);
            dmg *= 0.75;
          }
          hits.length = 0;
          this.sfx('zap');
          break;
        }

        case 'silo': {
          if (t.cd > 0) break;
          const e = this.pick(tx, ty, L.range, 1, L.chunk!);
          if (!e) break;
          t.cd = L.rate;
          t.pulse = 1;
          t.aimX = e.x;
          t.aimY = e.y;
          const ex = e.x;
          const ey = e.y;
          const mult = ENEMIES[e.type].ded;
          const got = Math.max(1, Math.round(this.damage(e, L.chunk!, 'deduct', GOLD, true)));
          this.vault += got;
          t.tally += got;
          this.beam('tractor', ex, ey, tx, ty, GOLD, 0.45, bw);
          for (let n = 0; n < 8; n++) {
            const life = 0.28 + rnd() * 0.25;
            const px = ex + (rnd() - 0.5) * 0.35;
            const py = ey + (rnd() - 0.5) * 0.35;
            this.particle(px, py, (tx - px) / life, (ty - py) / life, life, GOLD, 0.09, 0);
          }
          this.floater(ex, ey - 0.35, `-${got}${mult > 1 ? ' ×' + mult : ''}`, mult < 1 ? GREY : GOLD, mult > 1 ? 0.3 : 0.24, 0.8);
          this.floater(tx, ty - 0.5, `+$${got} VAULT`, GOLD, 0.2, 1.0);
          this.shake = Math.max(this.shake, 0.2);
          this.sfx('absorb');
          break;
        }

        case 'hsa': {
          if (t.cd > 0) break;
          const es = this.enemies;
          for (let j = 0; j < es.length; j++) {
            const e = es[j];
            if (e.dead || e.divert || e.type !== 'med') continue;
            const dx = e.x - tx;
            const dy = e.y - ty;
            if (dx * dx + dy * dy > r2) continue;
            t.cd = L.rate;
            t.pulse = 1;
            const pts = e.bounty * 3;
            this.shield = Math.min(SHIELD_CAP, this.shield + pts);
            this.beam('heal', e.x, e.y, tx, ty, MINT, 0.32, bw);
            this.floater(e.x, e.y - 0.3, `VOID ×3  +${pts} SHIELD`, MINT, 0.21, 1.1);
            this.exempt(e, true);
            this.sfx('heal');
            break;
          }
          break;
        }

        case 'charity': {
          if (t.cd > 0) break;
          if (!this.attract && this.gold < L.donate! + CHARITY_RESERVE) break;
          let e: Enemy | null = null;
          let bv = 1e9;
          const es = this.enemies;
          for (let j = 0; j < es.length; j++) {
            const c = es[j];
            if (c.dead || c.divert || c.immune > 0 || c.diverts >= MAX_DIVERTS || c.dist < 1.5) continue;
            const dx = c.x - tx;
            const dy = c.y - ty;
            if (dx * dx + dy * dy > r2) continue;
            if (c.left < bv) {
              bv = c.left;
              e = c;
            }
          }
          if (!e) break;
          t.cd = L.rate;
          t.pulse = 1;
          if (!this.attract) {
            this.gold -= L.donate!;
            this.donated += L.donate!;
            this.vpCharity += L.vp!;
          }
          this.diverted++;
          this.floater(tx, ty - 0.5, `+${L.vp} VP`, PINK, 0.24, 1.0);
          this.floater(tx + 0.15, ty + 0.15, `-$${L.donate}`, GOLD, 0.17, 0.7);
          this.ring(tx, ty, 0.2, L.range, PINK, 0.5, 2);
          this.sfx('divert');
          this.damage(e, Math.ceil(e.hp * L.cut!), 'flat', PINK, true);
          if (e.dead) break;
          const knock = L.knock! * (e.type === 'boss' ? 0.4 : e.type === 'top' ? 0.7 : 1);
          const toDist = Math.max(0.6, e.dist - knock);
          pathPos(this.layout.paths[e.path], toDist, P);
          const ex2 = P.x + e.ox;
          const ey2 = P.y + e.oy;
          e.divert = {
            t: 0,
            dur: 0.85,
            w: bw,
            fx: e.x,
            fy: e.y,
            // control point chosen so the arc passes through the channel itself
            vx: 2 * tx - (e.x + ex2) / 2,
            vy: 2 * ty - (e.y + ey2) / 2,
            tx: ex2,
            ty: ey2,
            toDist,
          };
          e.diverts++;
          break;
        }
      }
    }
  }

  private damage(e: Enemy, amount: number, kind: 'credit' | 'deduct' | 'flat', color: string, quiet = false): number {
    const d = ENEMIES[e.type];
    const mult = kind === 'credit' ? d.credit : kind === 'deduct' ? d.ded : 1;
    let a = amount * mult;
    if (this.campaignPerks.includes('liquidity') && kind !== 'flat') a *= 1.18;
    if (a > e.hp) a = e.hp;
    e.hp -= a;
    e.flash = 1;
    if (!quiet && a >= 0.5 && this.floaters.length < 70) {
      this.floater(e.x + (rnd() - 0.5) * 0.4, e.y - d.size - 0.3, `-${Math.round(a)}`, mult < 1 ? GREY : color, 0.17, 0.55);
    }
    if (e.hp < 0.5) this.exempt(e, false);
    return a;
  }

  private exempt(e: Enemy, voided: boolean) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const d = ENEMIES[e.type];
    this.gold += e.bounty + e.bonus;
    this.bonusGold += e.bonus;
    this.vpExempt += e.bounty * 10;
    this.exempted++;
    const big = e.type === 'top' || e.type === 'boss' || e.type === 'levy';
    this.burst(e.x, e.y, e.type === 'state' ? 7 : big ? 46 : 14, big ? 6 : 3.8, [MINT, INK, d.color], big ? 0.95 : 0.55);
    this.ring(e.x, e.y, d.size, d.size * (big ? 5.5 : 3.4), MINT, big ? 0.6 : 0.4, big ? 4 : 2);
    if (!voided) this.floater(e.x, e.y - 0.15, big ? 'WRITTEN OFF' : '$0', MINT, big ? 0.36 : 0.27, big ? 1.3 : 0.9, true);
    this.floater(e.x + 0.3, e.y + 0.25, `+$${e.bounty + e.bonus}`, GOLD, e.bonus > 0 ? 0.22 : 0.18, 0.8);
    if (e.bonus >= 8) this.floater(e.x, e.y + 0.62, `LARGE DEBT BONUS +$${e.bonus}`, GOLD, 0.2, 1.5);
    if (big) {
      this.shake = Math.max(this.shake, e.type === 'boss' ? 1 : 0.55);
      this.slowmo = e.type === 'boss' ? 0.6 : 0.16;
      this.ring(e.x, e.y, 0.2, e.type === 'boss' ? 4.5 : 2.6, INK, 0.8, 2);
      if (e.type === 'boss') for (let i = 0; i < 5; i++) this.firework(e.x + (rnd() - 0.5) * 3, e.y + (rnd() - 0.5) * 3, true);
      this.sfx('boom');
    }
    this.sfx('exempt');
  }

  private leak(e: Enemy) {
    e.dead = true;
    if (this.attract) return;
    const amt = Math.max(1, Math.ceil(e.hp));
    const blocked = Math.min(this.shield, amt);
    const hit = amt - blocked;
    this.shield -= blocked;
    if (blocked > 0) {
      this.floater(this.layout.castleX - 0.5, this.layout.castleY + 0.7, `SHIELD -${blocked}`, MINT, 0.24, 1.1);
      this.ring(this.layout.castleX, this.layout.castleY, 0.4, 1.8, MINT, 0.45, 3);
      this.sfx('shield');
    }
    if (hit > 0) {
      this.earnings = Math.max(0, this.earnings - hit);
      this.waveBill += hit;
      this.totalBill += hit;
      this.shake = Math.max(this.shake, Math.min(1, 0.5 + hit / 1500));
      this.hurt = 1;
      this.castleHit = 1;
      this.floater(this.layout.castleX - 0.6, this.layout.castleY - 0.6, `-$${hit}`, RED, 0.4, 1.3, true);
      this.burst(this.layout.castleX - 0.4, this.layout.castleY, 22, 4.5, [RED, '#ffb199', INK], 0.6);
      this.ring(this.layout.castleX, this.layout.castleY, 0.3, 2.4, RED, 0.5, 4);
      this.sfx('leak');
      if (this.earnings <= 0) this.finish(false);
    }
  }

  private waveCleared() {
    if (this.attract) {
      this.phase = 'build';
      this.countdown = 1.5;
      return;
    }
    const n = this.waveIndex + 1;
    const perfect = this.waveBill === 0;
    const bonus = 35 + 10 * n + Math.min(this.stage, 8) + (perfect ? 20 : 0);
    this.gold += bonus;
    this.vpWave += 250 * n + (perfect ? 500 * n : 0);
    if (perfect) this.perfectWaves++;
    const interest = Math.round(this.vault * VAULT_RATE);
    this.vault += interest;
    const liquidity = Math.round(this.vault * 0.018);
    if (liquidity > 0) {
      this.vault -= liquidity;
      this.gold += liquidity;
    }
    if (!this.attract) this.onWaveCleared(n, this.waves.length);

    const totalCash = bonus + liquidity;
    if (totalCash > 0) {
      this.floater(
        this.layout.castleX - 0.6,
        this.layout.castleY - 0.95,
        `WAVE +$${totalCash}`,
        GOLD,
        0.28,
        1.35,
        true,
      );
    }

    if (n >= this.waves.length) {
      this.finish(true);
      return;
    }
    this.phase = 'build';
    this.countdown = BUILD_TIME;
    const vaultTail = interest > 0 ? ` · vault +$${interest}` : '';
    const sub = `+$${totalCash} cash${vaultTail}`;
    if (perfect) {
      this.banner = { kind: 'perfect', top: `WAVE ${pad2(n)}`, title: 'PERFECT', sub, t: 0, dur: 2.5 };
      for (let i = 0; i < 6; i++) this.firework(1.5 + rnd() * (COLS - 3), 1 + rnd() * (ROWS - 2), i < 2);
      this.shake = Math.max(this.shake, 0.4);
      this.sfx('perfect');
    } else {
      this.banner = {
        kind: 'clear',
        top: `WAVE ${pad2(n)} CLEARED`,
        title: this.waveBill > 0 ? `$${this.waveBill} leaked` : 'CLEARED',
        sub,
        t: 0,
        dur: 2.3,
      };
      this.sfx('clear');
    }
  }

  private finish(won: boolean) {
    if (this.result) return;
    this.phase = won ? 'won' : 'lost';
    this.selected = null;
    this.cursor.show = false;
    this.endTime = 0;
    this.slowmo = 0.55;
    const zero = won && this.totalBill === 0;
    const vaultPay = won ? this.vault : Math.floor(this.vault * 0.9);
    const lines: ResultLine[] = [
      { label: 'Kills', value: this.vpExempt, note: `${this.exempted} enemies${this.bonusGold > 0 ? ` · +$${this.bonusGold} big-kill cash` : ''}` },
      { label: 'Wave bonuses', value: this.vpWave, note: `${this.perfectWaves} perfect wave${this.perfectWaves === 1 ? '' : 's'}` },
      { label: 'Charity', value: this.vpCharity, note: this.donated > 0 ? `$${this.donated} spent` : undefined },
      { label: 'Vault', value: vaultPay, note: won ? '+8% per wave cleared' : '−10% on loss' },
      { label: 'Shield ×3', value: this.shield * 3, note: `${this.shield} stored` },
    ];
    if (won) lines.push({ label: 'Life bonus ×5', value: this.earnings * 5, note: `$${this.earnings} left` });
    if (zero) lines.push({ label: 'Perfect bonus', value: 20000, note: 'no gate damage' });
    // difficulty scales everything scored on this stage (carried score was already scaled)
    const dd = DIFFS[this.diff];
    if (dd.score !== 1) {
      let sub = 0;
      for (const l of lines) sub += l.value;
      lines.push({ label: `${dd.name} difficulty ×${dd.score}`, value: Math.round(sub * dd.score) - sub, note: dd.bracket });
    }
    if (this.carry > 0) lines.unshift({ label: 'Carry-over', value: this.carry, note: `from earlier stages` });
    let score = 0;
    for (const l of lines) score += l.value;
    const final = this.stage >= STAGES.length - 1;
    this.result = {
      won,
      perfect: zero,
      score,
      wave: won ? this.waves.length : this.waveIndex + 1,
      bill: this.totalBill,
      lines,
      stage: this.stage,
      stages: STAGES.length,
      final,
      diff: this.diff,
    };

    if (won) {
      this.banner = zero
        ? { kind: 'win', top: 'TAX OWED: $0.00', title: 'TOTAL EXEMPTION', sub: final ? 'EVERY COLLECTOR WENT HOME EMPTY-HANDED' : `STAGE ${this.stage + 1} CLEARED · NEXT SHEET UNLOCKED`, t: 0, dur: 30 }
        : { kind: 'win', top: 'SEASON SURVIVED', title: 'RETURN ACCEPTED', sub: `TOTAL BILL PAID: $${this.totalBill}`, t: 0, dur: 30 };
      this.shake = 1;
      for (let i = 0; i < 10; i++) this.firework(1 + rnd() * (COLS - 2), 0.8 + rnd() * (ROWS - 1.6), true);
      this.sfx('win');
    } else {
      this.banner = { kind: 'lose', top: `WAVE ${pad2(this.waveIndex + 1)}`, title: 'AUDITED', sub: 'THE CASTLE HAS BEEN GARNISHED', t: 0, dur: 30 };
      this.shake = 1;
      this.hurt = 1;
      this.burst(this.layout.castleX, this.layout.castleY, 70, 8, [RED, '#ffb199', INK, GOLD], 1.2);
      this.ring(this.layout.castleX, this.layout.castleY, 0.3, 6, RED, 0.9, 5);
      this.ring(this.layout.castleX, this.layout.castleY, 0.3, 3.5, INK, 0.7, 3);
      this.sfx('lose');
    }
    this.onEnd(this.result);
  }

  // ── effects ─────────────────────────────────────────────────
  private updateFx(dt: number) {
    if (this.shake > 0) this.shake = this.shake < 0.01 ? 0 : this.shake * Math.exp(-dt * 5.5);
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 2.2);
    if (this.castleHit > 0) this.castleHit = Math.max(0, this.castleHit - dt * 2.5);
    if (this.goldFlash > 0) this.goldFlash = Math.max(0, this.goldFlash - dt * 3);

    const b = this.banner;
    if (b) {
      b.t += dt;
      if (b.t >= b.dur) this.banner = null;
    }

    if (this.phase === 'won' && this.endTime < 9) {
      this.fwTimer -= dt;
      if (this.fwTimer <= 0) {
        this.fwTimer = 0.1 + rnd() * 0.22;
        this.firework(0.8 + rnd() * (COLS - 1.6), 0.6 + rnd() * (ROWS - 1.2), rnd() < 0.4);
        if (rnd() < 0.5) this.sfx('pop');
      }
    }

    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
    }
    const bs = this.beams;
    for (let i = bs.length - 1; i >= 0; i--) {
      bs[i].life -= dt;
      if (bs[i].life <= 0) {
        bs[i] = bs[bs.length - 1];
        bs.pop();
      }
    }
    const rs = this.rings;
    for (let i = rs.length - 1; i >= 0; i--) {
      rs[i].life -= dt;
      if (rs[i].life <= 0) {
        rs[i] = rs[rs.length - 1];
        rs.pop();
      }
    }
    const fs = this.floaters;
    let w = 0;
    for (let i = 0; i < fs.length; i++) {
      const f = fs[i];
      f.life -= dt;
      if (f.life <= 0) continue;
      f.rise += dt * (0.35 + 1.1 * (f.life / f.max));
      fs[w++] = f;
    }
    fs.length = w;
  }

  private particle(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number, drag: number) {
    if (this.particles.length >= 520) return;
    this.particles.push({ x, y, vx, vy, life, max: life, color, size, drag });
  }

  private burst(x: number, y: number, n: number, speed: number, colors: string[], life: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const v = speed * (0.3 + rnd() * 0.7);
      this.particle(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.55 + rnd() * 0.7), colors[(rnd() * colors.length) | 0], 0.05 + rnd() * 0.07, 3.2);
    }
  }

  private spark(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const v = 1.2 + rnd() * 2.2;
      this.particle(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.16 + rnd() * 0.16, color, 0.05, 4);
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, color: string, life: number, w: number) {
    if (this.rings.length >= 60) return;
    this.rings.push({ x, y, r0, r1, life, max: life, color, w });
  }

  private beam(kind: Beam['kind'], x1: number, y1: number, x2: number, y2: number, color: string, life: number, w = 1) {
    this.beams.push({ kind, x1, y1, x2, y2, color, life, max: life, w });
  }

  private floater(x: number, y: number, text: string, color: string, size: number, life: number, big = false) {
    if (this.floaters.length >= 90) this.floaters.shift();
    this.floaters.push({ x, y, text, color, size, life, max: life, rise: 0, big });
  }

  private firework(x: number, y: number, big: boolean) {
    const cols = FIREWORKS[(rnd() * FIREWORKS.length) | 0];
    this.burst(x, y, big ? 40 : 24, big ? 6.5 : 4.4, cols, big ? 1.1 : 0.8);
    this.ring(x, y, 0.1, big ? 2.6 : 1.5, cols[0], 0.6, 3);
  }

  // ── HUD bridge ──────────────────────────────────────────────
  hudKey(): string {
    const s = this.selected;
    return (
      this.gold + '|' + this.earnings + '|' + this.shield + '|' + this.vault + '|' + this.score + '|' +
      this.waveIndex + '|' + this.phase + '|' + Math.ceil(this.countdown) + '|' + (this.enemies.length + this.queue.length) + '|' +
      this.buildType + '|' + (s ? s.id + ':' + s.level : '') + '|' + this.built + '|' + this.totalBill + '|' + this.stage
    );
  }

  snapshot(): Hud {
    const s = this.selected;
    const building = this.phase === 'build';
    const roster = this.waves;
    const idx = Math.max(0, Math.min(roster.length - 1, building ? this.waveIndex + 1 : this.waveIndex));
    const cap = maxTowerLevel(this.stage);
    let sel: HudSel | null = null;
    if (s) {
      const levels = TOWERS[s.type].levels;
      const hasNext = s.level < Math.min(levels.length - 1, cap);
      sel = {
        id: s.id,
        type: s.type,
        level: s.level,
        upCost: hasNext ? levels[s.level + 1].cost : null,
        sell: Math.round(s.spent * SELL_RATE),
        stats: towerStats(s.type, s.level),
        next: hasNext ? towerStats(s.type, s.level + 1) : null,
        tally: Math.round(s.tally),
      };
    }
    return {
      gold: this.gold,
      earnings: this.earnings,
      maxEarnings: this.maxEarnings,
      shield: this.shield,
      vault: this.vault,
      score: this.score,
      bill: this.totalBill,
      wave: idx + 1,
      waves: roster.length,
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      left: this.enemies.length + this.queue.length,
      name: roster[idx].name,
      tip: roster[idx].tip,
      buildType: this.buildType,
      sel,
      built: this.built,
      stage: this.stage + 1,
      stageName: STAGES[this.stage].name,
      diff: this.diff,
      maxTowerLevel: cap + 1,
      campaignPerks: this.campaignPerks,
    };
  }
}
