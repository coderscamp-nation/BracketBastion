// ─────────────────────────────────────────────────────────────
//  BRACKET BASTION — static game data (grid, path, towers, waves)
// ─────────────────────────────────────────────────────────────

export const COLS = 14;
export const ROWS = 8;

export const START_EARNINGS = 5000;
export const SHIELD_CAP = 999;
export const VAULT_RATE = 0.08;
export const BUILD_TIME = 10;
export const FIRST_DELAY = 1.2;
export const SELL_RATE = 0.7;
export const CHARITY_RESERVE = 15;
/** Liability multiplier applied to every collector, per wave. */
export const WAVE_HP = [1.72, 2.68, 3.72, 4.82, 6.05, 7.18, 8.22, 9.25, 10.2, 10.85];
export const MAX_DIVERTS = 3;
/** Writing off a collector whose starting bill is at least this much pays a cash bonus… */
export const BIG_DEBT = 400;
/** …worth this fraction of that starting bill. */
export const BIG_DEBT_RATE = 0.003;
/** Flat cash on every write-off — keeps mid-wave income pacing liability spikes (e.g. wave 4). */
export const KILL_STIPEND = 1;

/** Flat kill tip by collector size (before wave/stage multipliers on the bill). */
function killTip(baseHp: number): number {
  if (baseHp < 25) return 1;
  if (baseHp < 55) return 2;
  if (baseHp < 120) return 3;
  if (baseHp < 320) return 4;
  return 5;
}

/** Table bounty + mild liability scaling + flat tip + stipend so small kills aren't stingy and heavies pay more. */
export function killBounty(baseBounty: number, liabilityMult: number, baseHp: number): number {
  const growth = Math.min(1.15, 1 + Math.max(0, liabilityMult - 1) * 0.035);
  return Math.round(baseBounty * growth) + killTip(baseHp) + KILL_STIPEND;
}

// ── Difficulty ────────────────────────────────────────────────
// Chosen on the home screen and kept for the whole campaign. Named after the player's own bracket.
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyDef {
  name: string;
  bracket: string;
  /** multiplier on every collector's bill */
  hp: number;
  /** extra starting cash */
  gold: number;
  /** multiplier on everything scored in a stage */
  score: number;
}

export const DIFFS: Record<Difficulty, DifficultyDef> = {
  easy: { name: 'EASY', bracket: '10% bracket', hp: 0.8, gold: 40, score: 0.75 },
  normal: { name: 'NORMAL', bracket: '22% bracket', hp: 1.14, gold: 0, score: 1 },
  hard: { name: 'HARD', bracket: '37% bracket', hp: 1.32, gold: 0, score: 1.5 },
};

/** One-line description of what a difficulty changes, built from the numbers above. */
export function diffSummary(d: Difficulty): string {
  const f = DIFFS[d];
  const pct = Math.round((f.hp - 1) * 100);
  const parts = [pct === 0 ? 'standard bills' : `bills ${Math.abs(pct)}% ${pct < 0 ? 'smaller' : 'bigger'}`];
  if (f.gold) parts.push(`+$${f.gold} starting cash`);
  parts.push(`score ×${f.score}`);
  return `${f.bracket}: ${parts.join(', ')}.`;
}

export type TowerType = 'ctc' | 'ev' | 'silo' | 'hsa' | 'charity';
export type EnemyType = 'fica' | 'state' | 'fed' | 'med' | 'top' | 'boss' | 'est' | 'amt' | 'gift' | 'levy';

const urlFlag = (key: string) =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).get(key) === '1';

/**
 * Demo / dev: every stage appears on the title picker (normal rules otherwise).
 * `npm run dev`, or `?demo=1` on the URL.
 */
export const DEMO_ALL_STAGES = import.meta.env.DEV || urlFlag('demo');

/**
 * QA cheats only: max tower level, +$8K, all perks, no perk picker — not used for a fair demo.
 * Add `?test=1` to the URL (works in dev and production builds).
 */
export const TEST_UNLOCK_ALL = urlFlag('test');

export type CampaignPerk = 'liquidity' | 'shelter' | 'wildcard';

/** All campaign perks active while test unlock is on. */
export const TEST_CAMPAIGN_PERKS: CampaignPerk[] = ['liquidity', 'shelter', 'wildcard'];

/** Highest tower level index (0-based) allowed on this stage — display level is index + 1. */
export function maxTowerLevel(stageIndex: number): number {
  if (TEST_UNLOCK_ALL) return 5;
  const stageNo = stageIndex + 1;
  if (stageNo < 3) return 2;
  if (stageNo < 5) return 3;
  if (stageNo < 21) return 4;
  return 5;
}

/** Highest 0-based stage index selectable on the title screen. */
export function maxUnlockedStageIndex(): number {
  if (DEMO_ALL_STAGES || TEST_UNLOCK_ALL) return STAGES.length - 1;
  return -1;
}

/** 0-based stage indices where the player picks a campaign perk before filing. */
export const PERK_STAGE_INDICES = [9, 19, 29] as const;

export function isPerkStage(stageIndex: number): boolean {
  return (PERK_STAGE_INDICES as readonly number[]).includes(stageIndex);
}

export const TOWER_ORDER: TowerType[] = ['ctc', 'ev', 'silo', 'hsa', 'charity'];

export interface TowerLevel {
  cost: number;
  range: number;
  rate: number;
  dmg?: number;
  chain?: number;
  chunk?: number;
  slow?: number;
  knock?: number;
  donate?: number;
  vp?: number;
  cut?: number;
}

export interface TowerDef {
  name: string;
  short: string;
  kind: 'CREDIT' | 'SHELTER';
  color: string;
  tagline: string;
  levels: TowerLevel[];
}

export const TOWERS: Record<TowerType, TowerDef> = {
  ctc: {
    name: 'Child Tax Credit',
    short: 'Child Credit',
    kind: 'CREDIT',
    color: '#4ee8ff',
    tagline: 'Fast laser. Steady damage to any enemy.',
    levels: [
      { cost: 40, range: 2.1, rate: 0.22, dmg: 6 },
      { cost: 50, range: 2.35, rate: 0.2, dmg: 10 },
      { cost: 95, range: 2.6, rate: 0.17, dmg: 16 },
      { cost: 165, range: 2.85, rate: 0.15, dmg: 24 },
      { cost: 220, range: 3.1, rate: 0.13, dmg: 34 },
      { cost: 300, range: 3.35, rate: 0.11, dmg: 42 },
    ],
  },
  ev: {
    name: 'EV Credit',
    short: 'EV Credit',
    kind: 'CREDIT',
    color: '#c8ff4a',
    tagline: 'Arcs chain through groups. Great vs swarms.',
    levels: [
      { cost: 80, range: 3.1, rate: 1.3, dmg: 26, chain: 2 },
      { cost: 85, range: 3.4, rate: 1.15, dmg: 40, chain: 3 },
      { cost: 150, range: 3.8, rate: 1.0, dmg: 60, chain: 5 },
      { cost: 195, range: 4.1, rate: 0.9, dmg: 82, chain: 6 },
      { cost: 260, range: 4.4, rate: 0.82, dmg: 110, chain: 8 },
      { cost: 345, range: 4.7, rate: 0.74, dmg: 132, chain: 10 },
    ],
  },
  silo: {
    name: '401(k) / IRA Silo',
    short: '401(k) Silo',
    kind: 'SHELTER',
    color: '#ffd23f',
    tagline: 'Big hits plus Vault cash. Best vs heavies.',
    levels: [
      { cost: 70, range: 2.3, rate: 2.4, chunk: 80 },
      { cost: 80, range: 2.5, rate: 2.1, chunk: 130 },
      { cost: 140, range: 2.8, rate: 1.8, chunk: 210 },
      { cost: 185, range: 3.05, rate: 1.55, chunk: 290 },
      { cost: 245, range: 3.3, rate: 1.35, chunk: 380 },
      { cost: 325, range: 3.55, rate: 1.15, chunk: 465 },
    ],
  },
  hsa: {
    name: 'HSA Medic Station',
    short: 'HSA Medic',
    kind: 'SHELTER',
    color: '#5dffa8',
    tagline: 'Slows enemies. Instantly clears medical units.',
    levels: [
      { cost: 55, range: 1.9, rate: 0.2, slow: 0.35 },
      { cost: 60, range: 2.2, rate: 0.16, slow: 0.45 },
      { cost: 110, range: 2.5, rate: 0.12, slow: 0.55 },
      { cost: 150, range: 2.75, rate: 0.1, slow: 0.62 },
      { cost: 200, range: 3.0, rate: 0.085, slow: 0.7 },
      { cost: 270, range: 3.25, rate: 0.07, slow: 0.76 },
    ],
  },
  charity: {
    name: 'Charity Channel',
    short: 'Charity',
    kind: 'SHELTER',
    color: '#ff7bd5',
    tagline: 'Knocks enemies back. Spends cash for score.',
    levels: [
      { cost: 65, range: 2.0, rate: 3.4, knock: 4, donate: 5, vp: 150, cut: 0.1 },
      { cost: 70, range: 2.2, rate: 2.9, knock: 5, donate: 7, vp: 300, cut: 0.15 },
      { cost: 120, range: 2.5, rate: 2.4, knock: 6.5, donate: 9, vp: 500, cut: 0.2 },
      { cost: 160, range: 2.75, rate: 2.1, knock: 7.5, donate: 11, vp: 700, cut: 0.24 },
      { cost: 210, range: 3.0, rate: 1.85, knock: 8.5, donate: 13, vp: 950, cut: 0.28 },
      { cost: 280, range: 3.25, rate: 1.62, knock: 9.5, donate: 16, vp: 1250, cut: 0.32 },
    ],
  },
};

export function towerStats(type: TowerType, level: number): { k: string; v: string }[] {
  const L = TOWERS[type].levels[level];
  const rng = { k: 'RANGE', v: L.range.toFixed(1) };
  switch (type) {
    case 'ctc':
      return [{ k: 'CREDIT', v: `$${L.dmg}` }, { k: 'RATE', v: `${(1 / L.rate).toFixed(1)}/s` }, rng];
    case 'ev':
      return [{ k: 'ARC', v: `$${L.dmg}` }, { k: 'CHAIN', v: `×${(L.chain ?? 0) + 1}` }, rng];
    case 'silo':
      return [{ k: 'CHUNK', v: `$${L.chunk}` }, { k: 'CYCLE', v: `${L.rate}s` }, rng];
    case 'hsa':
      return [{ k: 'SLOW', v: `${Math.round((L.slow ?? 0) * 100)}%` }, { k: 'MEDICAL', v: 'VOID ×3' }, rng];
    case 'charity':
      return [{ k: 'DIVERT', v: `${L.knock} tiles` }, { k: 'GIVE', v: `$${L.donate}→${L.vp}VP` }, rng];
  }
}

export interface EnemyDef {
  name: string;
  tag: string;
  hp: number;
  speed: number;
  bounty: number;
  /** multiplier applied to deductions (401k) — scales with bracket */
  ded: number;
  /** multiplier applied to credits */
  credit: number;
  size: number;
  color: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  fica: { name: 'FICA Agent', tag: '', hp: 34, speed: 1.25, bounty: 5, ded: 0.75, credit: 1, size: 0.23, color: '#ff7a5c' },
  state: { name: 'State Bracket', tag: '', hp: 15, speed: 2.0, bounty: 2, ded: 0.6, credit: 1, size: 0.15, color: '#ffab40' },
  fed: { name: 'Federal Auditor', tag: '22', hp: 95, speed: 1.0, bounty: 9, ded: 1, credit: 1, size: 0.27, color: '#ff5d8a' },
  med: { name: 'Medical Bill', tag: '', hp: 55, speed: 1.6, bounty: 8, ded: 0.25, credit: 0.25, size: 0.23, color: '#ffffff' },
  top: { name: 'Top Marginal', tag: '37', hp: 260, speed: 0.72, bounty: 28, ded: 1.8, credit: 1, size: 0.33, color: '#ff4040' },
  boss: { name: 'The Commissioner', tag: 'IRS', hp: 1000, speed: 0.5, bounty: 150, ded: 1.8, credit: 1, size: 0.44, color: '#ff4040' },
  est: { name: 'Estate Assessor', tag: '40%', hp: 125, speed: 0.88, bounty: 22, ded: 1.35, credit: 0.9, size: 0.28, color: '#c77dff' },
  amt: { name: 'AMT Phantom', tag: 'AMT', hp: 78, speed: 1.3, bounty: 15, ded: 0.9, credit: 0.72, size: 0.2, color: '#9be4ff' },
  gift: { name: 'Gift Tax Officer', tag: 'GIFT', hp: 65, speed: 1.5, bounty: 13, ded: 0.5, credit: 1.05, size: 0.18, color: '#ffb3ec' },
  levy: { name: 'Tax Lien Marshal', tag: 'LIEN', hp: 380, speed: 0.62, bounty: 72, ded: 2.2, credit: 0.75, size: 0.36, color: '#ff6b3d' },
};

/** Extra collector types introduced as the campaign advances (one family per wave, not the whole roster at once). */
const TIER_SPAWNS: { fromStage: number; type: EnemyType; count: number; gap: number }[] = [
  { fromStage: 4, type: 'est', count: 2, gap: 2.4 },
  { fromStage: 7, type: 'amt', count: 2, gap: 1.25 },
  { fromStage: 10, type: 'gift', count: 3, gap: 1.0 },
  { fromStage: 13, type: 'levy', count: 1, gap: 5.5 },
  { fromStage: 21, type: 'levy', count: 2, gap: 4.8 },
  { fromStage: 24, type: 'top', count: 1, gap: 5.0 },
];

export interface WaveGroup {
  type: EnemyType;
  count: number;
  gap: number;
  delay?: number;
}

export interface WaveDef {
  name: string;
  tip: string;
  groups: WaveGroup[];
}

export const WAVES: WaveDef[] = [
  {
    name: 'FICA PATROL',
    tip: 'Weak enemies. Child Credit lasers work well.',
    groups: [{ type: 'fica', count: 8, gap: 0.95 }],
  },
  {
    name: 'STATE BRACKET SWARM',
    tip: 'Fast swarm. Use chain attacks.',
    groups: [
      { type: 'state', count: 18, gap: 0.38 },
      { type: 'fica', count: 4, gap: 1.3, delay: 4 },
    ],
  },
  {
    name: 'CO-PAY RUSH',
    tip: 'Medical units resist most towers — place an HSA.',
    groups: [
      { type: 'fica', count: 6, gap: 1.0 },
      { type: 'med', count: 4, gap: 1.2, delay: 3.5 },
    ],
  },
  {
    name: 'FEDERAL WITHHOLDING',
    tip: 'Tougher foes. A 401(k) Silo helps here.',
    groups: [
      { type: 'fed', count: 7, gap: 1.4 },
      { type: 'state', count: 8, gap: 0.4, delay: 5 },
    ],
  },
  {
    name: 'STATE BRACKET SWARM II',
    tip: 'Huge swarm. Slow and chain.',
    groups: [
      { type: 'state', count: 26, gap: 0.3 },
      { type: 'fed', count: 4, gap: 2.2, delay: 3 },
    ],
  },
  {
    name: 'DEDUCTIBLE STAMPEDE',
    tip: 'Many medical units mixed in.',
    groups: [
      { type: 'med', count: 10, gap: 0.75 },
      { type: 'fed', count: 6, gap: 1.5, delay: 2 },
      { type: 'fica', count: 8, gap: 0.6, delay: 9 },
    ],
  },
  {
    name: 'TOP MARGINAL WAVE',
    tip: 'Heavy hitters. Upgrades and Silos matter.',
    groups: [
      { type: 'top', count: 3, gap: 4.5 },
      { type: 'fed', count: 8, gap: 1.3, delay: 2 },
    ],
  },
  {
    name: 'FICA PATROL: OVERTIME',
    tip: 'Long wave. Charity can buy time.',
    groups: [
      { type: 'fica', count: 22, gap: 0.5 },
      { type: 'state', count: 14, gap: 0.3, delay: 6 },
      { type: 'med', count: 4, gap: 1, delay: 11 },
    ],
  },
  {
    name: 'AUDIT BLITZ',
    tip: 'Everything at once. Upgrade key towers.',
    groups: [
      { type: 'fed', count: 12, gap: 1.0 },
      { type: 'top', count: 3, gap: 4, delay: 4 },
      { type: 'med', count: 8, gap: 0.8, delay: 7 },
      { type: 'state', count: 16, gap: 0.3, delay: 13 },
    ],
  },
  {
    name: 'TOP MARGINAL WAVE: APRIL 15',
    tip: 'Boss incoming. Max your defenses.',
    groups: [
      { type: 'top', count: 5, gap: 3.2 },
      { type: 'fed', count: 10, gap: 1.1, delay: 2 },
      { type: 'boss', count: 1, gap: 1, delay: 11 },
      { type: 'state', count: 20, gap: 0.3, delay: 15 },
      { type: 'med', count: 6, gap: 0.9, delay: 19 },
    ],
  },
];

/** Stage-specific wave roster — light sprinkling of new types on later waves only. */
export function wavesForStage(stageIndex: number): WaveDef[] {
  const unlocked = TIER_SPAWNS.filter((t) => stageIndex >= t.fromStage);
  if (!unlocked.length) return WAVES;

  return WAVES.map((wave, wi) => {
    // Keep the first half of each stage on the base schedule so cash can compound.
    if (wi < 4) return wave;

    const extras: WaveGroup[] = [];
    const tier = unlocked[(wi + stageIndex) % unlocked.length];
    const progress = Math.max(0, stageIndex - tier.fromStage);
    const scale = 1 + Math.floor(progress / 5) * 0.08;
    const count = Math.max(1, Math.round(tier.count * scale * (0.85 + wi * 0.025)));
    extras.push({ type: tier.type, count, gap: tier.gap, delay: 7 + wi * 0.3 });

    // From wave 7 onward, late campaign stages may add a second lane of the next tier in line.
    if (wi >= 6 && unlocked.length > 1 && stageIndex >= 8) {
      const tier2 = unlocked[(wi + stageIndex + 1) % unlocked.length];
      const c2 = Math.max(1, Math.round(tier2.count * 0.5 * scale));
      extras.push({ type: tier2.type, count: c2, gap: tier2.gap * 1.15, delay: 12 + wi * 0.25 });
    }

    return { ...wave, groups: [...wave.groups, ...extras] };
  });
}

// ── Stages ────────────────────────────────────────────────────
// Each stage is its own "sheet": a different path layout, colour scheme and theme tune.
export interface StageTheme {
  /** page + canvas colours */
  paper: string;
  glow: string;
  path: string;
  plate: string;
  /** grid-line colour as "r,g,b" */
  line: string;
  /** CSS colour triplets ("r g b") for panels, chips and hover states */
  deep: string;
  chip: string;
  hover: string;
}

type Pt = readonly [number, number];

export interface StageDef {
  name: string;
  blurb: string;
  /** One or more lanes. Waypoints are cell coordinates; every lane ends at the castle gate. */
  paths: ReadonlyArray<ReadonlyArray<Pt>>;
  /** The castle always guards the right-hand column; this is its centre row. */
  castleRow: number;
  /** Tile of the free starter credit. */
  starter: Pt;
  /**
   * Liability multiplier for the whole stage. Tuned per layout (a short path is harder than a
   * long one at the same number) so that the stages get steadily tougher in order.
   */
  hp: number;
  /** Collector walking-speed multiplier. */
  speed: number;
  gold: number;
  theme: StageTheme;
}

/** Audit-risk label per stage, in order: every sheet is tougher than the one before. */
export const RISK = [
  'LOW',
  'GUARDED',
  'MODERATE',
  'ELEVATED',
  'HIGH',
  'VERY HIGH',
  'SEVERE',
  'CRITICAL',
  'EXTREME',
  'DIRE',
  'MAXIMUM',
  'CERTAIN',
  'AUDIT',
  'SUBPOENA',
  'LEVY',
  'GARNISH',
  'FORECLOSURE',
  'CONTEMPT',
  'SEIZURE',
  'ABSOLUTE',
  'ULTRA',
  'BEYOND',
  'APEX',
  'OMEGA',
  'TERMINAL',
  'SINGULAR',
  'APEX II',
  'ZERO HOUR',
];

/** Shared tail of the two Audit Junction lanes. */
const TRUNK: Pt[] = [
  [6, 4],
  [9, 4],
  [9, 1],
  [11, 1],
  [11, 5],
  [13, 5],
];

/** Shared entry and exit of the Itemizer's Fork lanes: one road in, two branches round an island, one road out. */
const FORK_IN: Pt[] = [
  [-1, 1],
  [1, 1],
  [1, 6],
  [3, 6],
  [3, 4],
  [5, 4],
];
const FORK_OUT: Pt[] = [
  [9, 4],
  [13, 4],
];

/** Shared tail of the Quarterly Squeeze lanes, from the merge point to the gate. */
const SQUEEZE: Pt[] = [
  [5, 4],
  [8, 4],
  [8, 1],
  [11, 1],
  [11, 6],
  [13, 6],
];

/** Shared trunk of the three Triple Net lanes, from the junction to the gate. */
const NET: Pt[] = [
  [7, 4],
  [7, 1],
  [10, 1],
  [10, 6],
  [13, 6],
];

export const STAGES: StageDef[] = [
  {
    name: 'W-2 FLATS',
    blurb: 'Long winding path. Tutorial map.',
    paths: [
      [
        [-1, 1],
        [2, 1],
        [2, 6],
        [5, 6],
        [5, 2],
        [8, 2],
        [8, 6],
        [11, 6],
        [11, 3],
        [13, 3],
      ],
    ],
    castleRow: 3,
    starter: [3, 3],
    hp: 1,
    speed: 1,
    gold: 170,
    theme: {
      paper: '#06204f',
      glow: '#0d3f93',
      path: '#04173f',
      plate: 'rgba(4,16,44,0.92)',
      line: '190,225,255',
      deep: '4 21 56',
      chip: '10 47 115',
      hover: '17 65 154',
    },
  },
  {
    name: 'LOOPHOLE LOOP',
    blurb: 'Path crosses itself — cover the junction.',
    paths: [
      [
        [-1, 4],
        [9, 4],
        [9, 1],
        [5, 1],
        [5, 6],
        [11, 6],
        [11, 3],
        [13, 3],
      ],
    ],
    castleRow: 3,
    starter: [4, 3],
    hp: 1.35,
    speed: 1.02,
    gold: 180,
    theme: {
      paper: '#052e2b',
      glow: '#0a5a50',
      path: '#031f1d',
      plate: 'rgba(3,20,20,0.92)',
      line: '185,255,225',
      deep: '3 28 27',
      chip: '8 70 63',
      hover: '12 100 90',
    },
  },
  {
    name: 'CAPITAL GAINS GULCH',
    blurb: 'Short path from the north.',
    paths: [
      [
        [3, -1],
        [3, 5],
        [7, 5],
        [7, 1],
        [11, 1],
        [11, 4],
        [13, 4],
      ],
    ],
    castleRow: 4,
    starter: [4, 3],
    hp: 0.9,
    speed: 1.04,
    gold: 190,
    theme: {
      paper: '#22104a',
      glow: '#47248f',
      path: '#150a31',
      plate: 'rgba(15,8,38,0.92)',
      line: '225,205,255',
      deep: '20 10 48',
      chip: '54 28 112',
      hover: '78 42 158',
    },
  },
  {
    name: 'AUDIT JUNCTION',
    blurb: 'Two lanes merge — hold the trunk.',
    paths: [
      [[-1, 1], [6, 1], ...TRUNK],
      [[-1, 6], [6, 6], ...TRUNK],
    ],
    castleRow: 5,
    starter: [7, 3],
    hp: 1.05,
    speed: 1.06,
    gold: 200,
    theme: {
      paper: '#16181e',
      glow: '#2c313c',
      path: '#0b0c10',
      plate: 'rgba(9,10,14,0.92)',
      line: '255,190,170',
      deep: '13 15 19',
      chip: '44 48 60',
      hover: '66 72 90',
    },
  },
  {
    name: 'DEPRECIATION DUNES',
    blurb: 'Long climb from the south edge.',
    paths: [
      [
        [2, 8],
        [2, 1],
        [6, 1],
        [6, 5],
        [9, 5],
        [9, 2],
        [13, 2],
      ],
    ],
    castleRow: 2,
    starter: [3, 5],
    hp: 0.96,
    speed: 1.08,
    gold: 200,
    theme: {
      paper: '#2c1f08',
      glow: '#5a4012',
      path: '#1f1605',
      plate: 'rgba(26,18,4,0.92)',
      line: '255,228,170',
      deep: '26 18 4',
      chip: '82 58 16',
      hover: '116 84 24',
    },
  },
  {
    name: "ITEMIZER'S FORK",
    blurb: 'Split around an island — fortify the middle.',
    paths: [
      [...FORK_IN, [5, 2], [9, 2], ...FORK_OUT],
      [...FORK_IN, [5, 6], [9, 6], ...FORK_OUT],
    ],
    castleRow: 4,
    starter: [2, 2],
    hp: 0.82,
    speed: 1.1,
    gold: 210,
    theme: {
      paper: '#18280f',
      glow: '#35561d',
      path: '#0e1808',
      plate: 'rgba(10,18,6,0.92)',
      line: '215,255,190',
      deep: '14 24 9',
      chip: '44 72 24',
      hover: '62 100 34',
    },
  },
  {
    name: 'QUARTERLY SQUEEZE',
    blurb: 'North and south lanes merge in the middle.',
    paths: [
      [[2, -1], [2, 2], [5, 2], ...SQUEEZE],
      [[2, 8], [2, 6], [5, 6], ...SQUEEZE],
    ],
    castleRow: 6,
    starter: [4, 4],
    hp: 0.99,
    speed: 1.12,
    gold: 210,
    theme: {
      paper: '#2b0e24',
      glow: '#591b49',
      path: '#1f0919',
      plate: 'rgba(24,7,20,0.92)',
      line: '255,200,235',
      deep: '25 8 21',
      chip: '76 25 63',
      hover: '108 36 89',
    },
  },
  {
    name: 'STEPPED-UP BASIS',
    blurb: 'Stair-step path — both sides of each step.',
    paths: [
      [
        [-1, 0],
        [2, 0],
        [2, 2],
        [5, 2],
        [5, 4],
        [8, 4],
        [8, 6],
        [13, 6],
      ],
    ],
    castleRow: 6,
    starter: [3, 1],
    hp: 0.77,
    speed: 1.13,
    gold: 220,
    theme: {
      paper: '#062a38',
      glow: '#0d556e',
      path: '#041c26',
      plate: 'rgba(3,20,28,0.92)',
      line: '190,240,255',
      deep: '4 26 35',
      chip: '12 76 98',
      hover: '18 104 134',
    },
  },
  {
    name: 'BACKDOOR ROTH',
    blurb: 'Enemies loop behind your base.',
    paths: [
      [
        [11, -1],
        [11, 1],
        [1, 1],
        [1, 6],
        [11, 6],
        [11, 4],
        [13, 4],
      ],
    ],
    castleRow: 4,
    starter: [10, 2],
    hp: 0.79,
    speed: 1.14,
    gold: 220,
    theme: {
      paper: '#26270b',
      glow: '#4f511a',
      path: '#161707',
      plate: 'rgba(18,19,5,0.92)',
      line: '240,245,180',
      deep: '22 23 6',
      chip: '72 74 22',
      hover: '100 103 32',
    },
  },
  {
    name: 'DOUBLE TAXATION',
    blurb: 'Two lanes cross in the center.',
    paths: [
      [
        [-1, 1],
        [5, 1],
        [5, 6],
        [10, 6],
        [10, 4],
        [11, 4],
        [13, 4],
      ],
      [
        [-1, 6],
        [2, 6],
        [2, 3],
        [8, 3],
        [8, 1],
        [11, 1],
        [11, 4],
        [13, 4],
      ],
    ],
    castleRow: 4,
    starter: [4, 4],
    hp: 0.74,
    speed: 1.15,
    gold: 230,
    theme: {
      paper: '#162231',
      glow: '#30475f',
      path: '#0d151f',
      plate: 'rgba(10,16,24,0.92)',
      line: '200,225,255',
      deep: '14 22 32',
      chip: '44 64 88',
      hover: '62 88 120',
    },
  },
  {
    name: 'TRIPLE NET',
    blurb: 'Three lanes join one road.',
    paths: [
      [[-1, 4], [4, 4], ...NET],
      [[4, -1], [4, 4], ...NET],
      [[4, 8], [4, 4], ...NET],
    ],
    castleRow: 6,
    starter: [5, 3],
    hp: 1.07,
    speed: 1.16,
    gold: 230,
    theme: {
      paper: '#2d0a11',
      glow: '#5f1524',
      path: '#1b060a',
      plate: 'rgba(22,5,9,0.92)',
      line: '255,200,205',
      deep: '27 6 10',
      chip: '86 20 34',
      hover: '120 30 48',
    },
  },
  {
    name: 'FINAL NOTICE',
    blurb: 'Long road with three tight turns.',
    paths: [
      [
        [-1, 2],
        [10, 2],
        [10, 6],
        [3, 6],
        [3, 0],
        [7, 0],
        [7, 4],
        [13, 4],
      ],
    ],
    castleRow: 4,
    starter: [2, 3],
    hp: 2,
    speed: 1.17,
    gold: 240,
    theme: {
      paper: '#0c0b08',
      glow: '#2b2512',
      path: '#050504',
      plate: 'rgba(6,6,4,0.94)',
      line: '255,214,90',
      deep: '10 9 6',
      chip: '48 42 22',
      hover: '74 64 32',
    },
  },
  {
    name: 'LIEN LEDGER',
    blurb: 'Spiral — cover the outer ring.',
    paths: [
      [
        [-1, 3],
        [3, 3],
        [3, 0],
        [8, 0],
        [8, 5],
        [5, 5],
        [5, 7],
        [11, 7],
        [11, 2],
        [13, 2],
      ],
    ],
    castleRow: 2,
    starter: [4, 4],
    hp: 0.88,
    speed: 1.18,
    gold: 240,
    theme: {
      paper: '#1a1428',
      glow: '#3d2f5c',
      path: '#0f0b18',
      plate: 'rgba(12,9,18,0.93)',
      line: '220,200,255',
      deep: '16 12 30',
      chip: '52 40 78',
      hover: '76 58 110',
    },
  },
  {
    name: 'PASS-THROUGH TRUST',
    blurb: 'Two sharp bends — overlap towers.',
    paths: [
      [
        [-1, 2],
        [4, 2],
        [4, 5],
        [9, 5],
        [9, 1],
        [13, 1],
      ],
      [
        [-1, 6],
        [6, 6],
        [6, 3],
        [11, 3],
        [11, 6],
        [13, 6],
      ],
    ],
    castleRow: 4,
    starter: [2, 4],
    hp: 0.86,
    speed: 1.19,
    gold: 240,
    theme: {
      paper: '#0f2418',
      glow: '#1f4a32',
      path: '#091810',
      plate: 'rgba(8,20,12,0.93)',
      line: '190,255,210',
      deep: '12 30 18',
      chip: '34 76 48',
      hover: '50 108 68',
    },
  },
  {
    name: 'AMT MAZE',
    blurb: 'Alternating corridors.',
    paths: [
      [
        [0, -1],
        [0, 2],
        [4, 2],
        [4, 6],
        [8, 6],
        [8, 0],
        [12, 0],
        [12, 4],
        [13, 4],
      ],
    ],
    castleRow: 4,
    starter: [2, 4],
    hp: 0.84,
    speed: 1.2,
    gold: 240,
    theme: {
      paper: '#102038',
      glow: '#204878',
      path: '#0a1428',
      plate: 'rgba(8,16,32,0.93)',
      line: '180,220,255',
      deep: '12 24 42',
      chip: '32 68 120',
      hover: '46 98 168',
    },
  },
  {
    name: 'GIFT TAX GALLERY',
    blurb: 'Wide loop — choke the door.',
    paths: [
      [
        [-1, 4],
        [2, 4],
        [2, 1],
        [10, 1],
        [10, 6],
        [6, 6],
        [6, 3],
        [13, 3],
      ],
    ],
    castleRow: 3,
    starter: [5, 2],
    hp: 0.83,
    speed: 1.21,
    gold: 240,
    theme: {
      paper: '#2a1830',
      glow: '#5a2e68',
      path: '#1a0e20',
      plate: 'rgba(22,12,26,0.93)',
      line: '255,210,245',
      deep: '30 16 36',
      chip: '82 44 96',
      hover: '118 62 138',
    },
  },
  {
    name: 'ESTATE ESCALATOR',
    blurb: 'Many landings along the climb.',
    paths: [
      [[-1, 1], [3, 1], [3, 3], [7, 3], [7, 5], [11, 5], [11, 7], [13, 7]],
      [[-1, 6], [5, 6], [5, 2], [9, 2], [9, 4], [13, 4]],
    ],
    castleRow: 4,
    starter: [4, 4],
    hp: 0.92,
    speed: 1.22,
    gold: 240,
    theme: {
      paper: '#281a0c',
      glow: '#54361a',
      path: '#180e06',
      plate: 'rgba(20,12,6,0.93)',
      line: '255,228,190',
      deep: '28 18 8',
      chip: '80 54 24',
      hover: '114 78 36',
    },
  },
  {
    name: 'CARRIED INTEREST',
    blurb: 'Long legs — range upgrades help.',
    paths: [
      [
        [1, -1],
        [1, 7],
        [5, 7],
        [5, 1],
        [9, 1],
        [9, 6],
        [13, 6],
      ],
    ],
    castleRow: 6,
    starter: [3, 3],
    hp: 0.81,
    speed: 1.23,
    gold: 240,
    theme: {
      paper: '#181e22',
      glow: '#344a58',
      path: '#0e1418',
      plate: 'rgba(12,16,20,0.93)',
      line: '210,230,240',
      deep: '18 22 28',
      chip: '48 66 80',
      hover: '68 94 114',
    },
  },
  {
    name: 'OFFSHORE OVERPASS',
    blurb: 'Lanes cross in an X.',
    paths: [
      [
        [-1, 2],
        [6, 2],
        [6, 6],
        [13, 6],
      ],
      [
        [-1, 5],
        [5, 5],
        [5, 1],
        [13, 1],
      ],
    ],
    castleRow: 3,
    starter: [4, 4],
    hp: 0.8,
    speed: 1.24,
    gold: 240,
    theme: {
      paper: '#0a2830',
      glow: '#185868',
      path: '#061c22',
      plate: 'rgba(6,22,26,0.93)',
      line: '170,240,255',
      deep: '8 30 36',
      chip: '24 84 98',
      hover: '34 118 140',
    },
  },
  {
    name: 'APRIL INFINITE',
    blurb: 'Three merges, one gate.',
    paths: [
      [[-1, 1], [4, 1], [4, 4], ...NET],
      [[-1, 4], [4, 4], ...NET],
      [[-1, 7], [4, 7], [4, 4], ...NET],
    ],
    castleRow: 6,
    starter: [6, 3],
    hp: 1.15,
    speed: 1.25,
    gold: 240,
    theme: {
      paper: '#140608',
      glow: '#3a1018',
      path: '#0a0406',
      plate: 'rgba(8,4,6,0.94)',
      line: '255,180,190',
      deep: '16 6 8',
      chip: '58 18 24',
      hover: '88 28 38',
    },
  },
  {
    name: 'CAPITAL GAUNTLET',
    blurb: 'Twin short lanes — overlap both.',
    paths: [
      [
        [-1, 1],
        [3, 1],
        [3, 6],
        [8, 6],
        [13, 6],
      ],
      [
        [-1, 5],
        [5, 5],
        [5, 2],
        [10, 2],
        [13, 2],
      ],
    ],
    castleRow: 4,
    starter: [2, 4],
    hp: 1,
    speed: 1,
    gold: 265,
    theme: {
      paper: '#281a10',
      glow: '#5c3a18',
      path: '#181008',
      plate: 'rgba(20,12,6,0.93)',
      line: '255,210,170',
      deep: '28 18 8',
      chip: '78 48 24',
      hover: '108 68 34',
    },
  },
  {
    name: 'SCHEDULE K KNOT',
    blurb: 'Tight zigzag, little time to react.',
    paths: [
      [
        [-1, 3],
        [2, 3],
        [2, 0],
        [5, 0],
        [5, 6],
        [8, 6],
        [8, 1],
        [13, 1],
      ],
    ],
    castleRow: 1,
    starter: [3, 4],
    hp: 1,
    speed: 1,
    gold: 270,
    theme: {
      paper: '#141428',
      glow: '#2a2a58',
      path: '#0c0c1a',
      plate: 'rgba(10,10,22,0.93)',
      line: '200,200,255',
      deep: '14 14 32',
      chip: '44 44 90',
      hover: '64 64 128',
    },
  },
  {
    name: 'DEPRECIATION DOCK',
    blurb: 'Three lanes, one dock.',
    paths: [
      [[-1, 0], [3, 0], [3, 4], ...SQUEEZE],
      [[-1, 4], [3, 4], ...SQUEEZE],
      [[-1, 7], [3, 7], [3, 4], ...SQUEEZE],
    ],
    castleRow: 6,
    starter: [5, 3],
    hp: 1,
    speed: 1,
    gold: 275,
    theme: {
      paper: '#182018',
      glow: '#305030',
      path: '#101410',
      plate: 'rgba(12,16,12,0.93)',
      line: '190,240,190',
      deep: '14 28 14',
      chip: '38 76 38',
      hover: '54 108 54',
    },
  },
  {
    name: 'EXPAT EXCHANGE',
    blurb: 'Compressed loop — outer ring rush.',
    paths: [
      [
        [-1, 4],
        [2, 4],
        [2, 1],
        [6, 1],
        [6, 6],
        [10, 6],
        [10, 3],
        [13, 3],
      ],
    ],
    castleRow: 3,
    starter: [4, 4],
    hp: 1,
    speed: 1,
    gold: 280,
    theme: {
      paper: '#1a1028',
      glow: '#3a2060',
      path: '#100818',
      plate: 'rgba(12,8,20,0.93)',
      line: '220,190,255',
      deep: '20 12 34',
      chip: '56 34 92',
      hover: '78 48 128',
    },
  },
  {
    name: 'TRUST TRIAD',
    blurb: 'Three quick merges.',
    paths: [
      [[-1, 1], [4, 1], [4, 4], ...NET],
      [[-1, 4], [4, 4], ...NET],
      [[-1, 7], [4, 7], [4, 4], ...NET],
    ],
    castleRow: 6,
    starter: [6, 2],
    hp: 1,
    speed: 1,
    gold: 285,
    theme: {
      paper: '#281018',
      glow: '#582838',
      path: '#18080c',
      plate: 'rgba(22,8,12,0.93)',
      line: '255,180,200',
      deep: '30 10 14',
      chip: '84 28 38',
      hover: '118 40 54',
    },
  },
  {
    name: 'BONUS BASIS',
    blurb: 'Short sprint to the gate.',
    paths: [
      [
        [-1, 2],
        [4, 2],
        [4, 5],
        [7, 5],
        [13, 5],
      ],
    ],
    castleRow: 5,
    starter: [2, 3],
    hp: 1,
    speed: 1,
    gold: 290,
    theme: {
      paper: '#102830',
      glow: '#205868',
      path: '#081820',
      plate: 'rgba(6,18,24,0.93)',
      line: '170,230,255',
      deep: '10 30 38',
      chip: '28 72 98',
      hover: '40 104 138',
    },
  },
  {
    name: 'CARRYFORWARD CROSS',
    blurb: 'Lanes cross late — hold center.',
    paths: [
      [
        [-1, 1],
        [7, 1],
        [7, 6],
        [13, 6],
      ],
      [
        [-1, 6],
        [6, 6],
        [6, 1],
        [13, 1],
      ],
    ],
    castleRow: 3,
    starter: [4, 4],
    hp: 1,
    speed: 1,
    gold: 295,
    theme: {
      paper: '#201818',
      glow: '#483030',
      path: '#140c0c',
      plate: 'rgba(16,10,10,0.93)',
      line: '255,200,180',
      deep: '24 14 14',
      chip: '68 38 34',
      hover: '94 52 46',
    },
  },
  {
    name: 'INSTALLMENT RAIL',
    blurb: 'Dual stairs — both climbs.',
    paths: [
      [
        [-1, 6],
        [2, 6],
        [2, 3],
        [5, 3],
        [5, 0],
        [13, 0],
      ],
      [
        [-1, 1],
        [3, 1],
        [3, 4],
        [6, 4],
        [6, 7],
        [10, 7],
        [10, 2],
        [13, 2],
      ],
    ],
    castleRow: 1,
    starter: [4, 5],
    hp: 1,
    speed: 1,
    gold: 298,
    theme: {
      paper: '#182028',
      glow: '#384858',
      path: '#101418',
      plate: 'rgba(12,14,20,0.93)',
      line: '200,220,240',
      deep: '16 22 30',
      chip: '46 62 84',
      hover: '64 88 118',
    },
  },
  {
    name: 'REVENUE REVERSAL',
    blurb: 'Four spokes, one gate.',
    paths: [
      [[-1, 0], [5, 0], [5, 4], [8, 4], [13, 4]],
      [[-1, 3], [3, 3], [3, 4], [8, 4]],
      [[-1, 6], [5, 6], [5, 4], [8, 4]],
      [[-1, 2], [2, 2], [2, 4], [8, 4]],
    ],
    castleRow: 4,
    starter: [6, 2],
    hp: 1,
    speed: 1,
    gold: 300,
    theme: {
      paper: '#201020',
      glow: '#502850',
      path: '#140814',
      plate: 'rgba(16,8,16,0.93)',
      line: '255,170,255',
      deep: '28 10 28',
      chip: '76 34 76',
      hover: '108 48 108',
    },
  },
  {
    name: 'STATUTE CLOSURE',
    blurb: 'Four merges. Campaign finale.',
    paths: [
      [[-1, 1], [3, 1], [3, 4], ...NET],
      [[-1, 4], [3, 4], ...NET],
      [[-1, 7], [3, 7], [3, 4], ...NET],
      [[7, -1], [7, 4], ...NET],
    ],
    castleRow: 6,
    starter: [5, 2],
    hp: 1,
    speed: 1,
    gold: 310,
    theme: {
      paper: '#080810',
      glow: '#28283a',
      path: '#040408',
      plate: 'rgba(4,4,8,0.95)',
      line: '255,220,120',
      deep: '8 8 18',
      chip: '28 28 48',
      hover: '42 42 78',
    },
  },
];

/** Longest Manhattan path length among lanes (longer paths give more reaction time). */
function pathLength(def: StageDef): number {
  let best = 0;
  for (const pts of def.paths) {
    let n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      n += Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
    }
    best = Math.max(best, n);
  }
  return best;
}

/** Lower = easier layout (fewer lanes, longer paths). Used to sort the campaign. */
function stageLayoutRank(def: StageDef): number {
  const lanes = def.paths.length;
  const len = pathLength(def);
  const turns = def.paths.reduce((n, pts) => n + Math.max(0, pts.length - 2), 0);
  return lanes * 14 + Math.max(0, 26 - len) * 2.8 + turns * 0.15;
}

/** Easiest layouts first; hp, speed and payout ramp with stage index. */
STAGES.sort((a, b) => stageLayoutRank(a) - stageLayoutRank(b) || a.name.localeCompare(b.name));
for (let i = 0; i < STAGES.length; i++) {
  const t = i / Math.max(1, STAGES.length - 1);
  const def = STAGES[i];
  const lanes = def.paths.length;
  const len = pathLength(def);
  const layout = Math.max(0, 25 - len) * 0.01 + (lanes - 1) * 0.038;
  def.hp = 0.88 + t * 1.02 + layout;
  def.speed = 1 + t * 0.23 + (lanes - 1) * 0.012;
  if (i >= 20) def.gold = 260 + Math.min(9, i - 20) * 6;
}

// ── Layout (compiled once per stage) ──────────────────────────
interface Seg {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  len: number;
  start: number;
}

export interface PathData {
  pts: ReadonlyArray<Pt>;
  segs: Seg[];
  len: number;
  /** distance at which a collector reaches the gate */
  gate: number;
}

export interface Layout {
  paths: PathData[];
  /** per cell: 0 buildable ground · 1 path · 2 castle */
  kinds: Uint8Array;
  castleX: number;
  castleY: number;
}

const layouts: (Layout | undefined)[] = [];

export function getLayout(stage: number): Layout {
  const hit = layouts[stage];
  if (hit) return hit;
  const def = STAGES[stage];
  const kinds = new Uint8Array(COLS * ROWS);
  const paths: PathData[] = def.paths.map((pts) => {
    const segs: Seg[] = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      segs.push({ x0, y0, dx, dy, len, start: total });
      total += len;
      for (let k = 0; k <= len; k++) {
        const cx = x0 + dx * k;
        const cy = y0 + dy * k;
        if (inGrid(cx, cy)) kinds[cy * COLS + cx] = 1;
      }
    }
    return { pts, segs, len: total, gate: total - 0.62 };
  });
  for (let r = def.castleRow - 1; r <= def.castleRow + 1; r++) kinds[r * COLS + (COLS - 1)] = 2;
  const layout: Layout = { paths, kinds, castleX: COLS - 0.5, castleY: def.castleRow + 0.5 };
  layouts[stage] = layout;
  return layout;
}

export interface PathPoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** Writes the world position (cell units) at `dist` along a lane into `out`. */
export function pathPos(p: PathData, dist: number, out: PathPoint): PathPoint {
  const d = dist < 0 ? 0 : dist > p.len ? p.len : dist;
  const segs = p.segs;
  let seg = segs[segs.length - 1];
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i].start + segs[i].len) {
      seg = segs[i];
      break;
    }
  }
  const t = d - seg.start;
  out.x = seg.x0 + seg.dx * t + 0.5;
  out.y = seg.y0 + seg.dy * t + 0.5;
  out.dx = seg.dx;
  out.dy = seg.dy;
  return out;
}

export function inGrid(cx: number, cy: number) {
  return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
}
