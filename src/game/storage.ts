import type { Difficulty } from './config';

// Local high-score table ("Filing History") persisted in localStorage.

export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  wave: number;
  won: boolean;
  perfect: boolean;
  date: number;
  /** 1-based stage this run reached (older saves have none = stage 1) */
  stage?: number;
  /** difficulty the run was played on (older saves have none = normal) */
  diff?: Difficulty;
}

const KEY = 'bracket-bastion.scores.v1';
const NAME_KEY = 'bracket-bastion.name';
const STAGE_KEY = 'bracket-bastion.unlocked';
const PROGRESS_KEY = 'bracket-bastion.progress.v1';
const DIFF_KEY = 'bracket-bastion.difficulty';
const MAX = 8;

interface DiffProgress {
  /** Highest 0-based stage index selectable on the title picker. */
  unlocked: number;
  /** Per stage: highest wave fully cleared (1–10). */
  waves: Record<number, number>;
}

interface CampaignProgress {
  byDiff: Record<Difficulty, DiffProgress>;
}

function emptyDiffProgress(): DiffProgress {
  return { unlocked: 0, waves: {} };
}

function readProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as CampaignProgress;
      if (p?.byDiff) {
        for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
          p.byDiff[d] ??= emptyDiffProgress();
          p.byDiff[d].waves ??= {};
        }
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  const legacy = getUnlockedLegacy();
  const migrated: CampaignProgress = {
    byDiff: {
      easy: emptyDiffProgress(),
      normal: { unlocked: legacy, waves: {} },
      hard: emptyDiffProgress(),
    },
  };
  writeProgress(migrated);
  return migrated;
}

function writeProgress(p: CampaignProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function getUnlockedLegacy(): number {
  try {
    const n = Number(localStorage.getItem(STAGE_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function read(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.score === 'number' && typeof e.name === 'string')
      .sort((a: ScoreEntry, b: ScoreEntry) => b.score - a.score)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — scores live for this session only */
  }
}

export function loadScores(): ScoreEntry[] {
  return read();
}

export function getName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'YOU';
  } catch {
    return 'YOU';
  }
}

export function cleanName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9 ._-]/g, '').slice(0, 10);
}

/** Adds a run to the table. Returns the saved entry (even if it missed the cut) and the new table. */
export function addScore(run: Omit<ScoreEntry, 'id' | 'name' | 'date'>): { entry: ScoreEntry; list: ScoreEntry[] } {
  const entry: ScoreEntry = {
    ...run,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: getName(),
    date: Date.now(),
  };
  const list = [...read(), entry].sort((a, b) => b.score - a.score).slice(0, MAX);
  write(list);
  return { entry, list };
}

export function renameScore(id: string, name: string): ScoreEntry[] {
  const clean = cleanName(name) || 'YOU';
  try {
    localStorage.setItem(NAME_KEY, clean);
  } catch {
    /* ignore */
  }
  const list = read().map((e) => (e.id === id ? { ...e, name: clean } : e));
  write(list);
  return list;
}

/**
 * Saves a campaign run. A run keeps one line in the table: continuing to the next stage
 * (or retrying a stage) updates that line whenever the cumulative score improves.
 */
export function saveRun(id: string | null, run: Omit<ScoreEntry, 'id' | 'name' | 'date'>): { entry: ScoreEntry; list: ScoreEntry[] } {
  const list = read();
  const old = id ? list.find((e) => e.id === id) : undefined;
  if (!old) return addScore(run);
  if (run.score <= old.score) return { entry: old, list };
  const entry: ScoreEntry = { ...old, ...run, date: Date.now() };
  const next = list
    .map((e) => (e.id === old.id ? entry : e))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);
  write(next);
  return { entry, list: next };
}

/** Highest stage index (0-based) the player may start from (current difficulty in storage — prefer `getUnlockedFor`). */
export function getUnlocked(): number {
  return getUnlockedFor(getDifficulty());
}

/** Highest selectable stage for a difficulty (cached campaign progress). */
export function getUnlockedFor(diff: Difficulty): number {
  return readProgress().byDiff[diff].unlocked;
}

/** Waves fully cleared on a stage for this difficulty (0–10). */
export function getWavesBeat(diff: Difficulty, stageIndex: number): number {
  const w = readProgress().byDiff[diff].waves[stageIndex];
  return typeof w === 'number' ? Math.max(0, Math.min(10, w)) : 0;
}

/** Indices of stages with at least one wave cleared (for quick browse). */
export function getTouchedStages(diff: Difficulty): number[] {
  const { unlocked, waves } = readProgress().byDiff[diff];
  const set = new Set<number>();
  for (let i = 0; i <= unlocked; i++) set.add(i);
  for (const k of Object.keys(waves)) {
    const i = Number(k);
    if (Number.isFinite(i) && waves[i] > 0) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}

function setUnlockedFor(diff: Difficulty, index: number): number {
  const p = readProgress();
  const next = Math.max(p.byDiff[diff].unlocked, Math.max(0, index));
  p.byDiff[diff].unlocked = next;
  writeProgress(p);
  try {
    if (diff === 'normal') localStorage.setItem(STAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Record a cleared wave (1-based wave number). Unlocks the next stage at 10/10. */
export function recordWaveCleared(diff: Difficulty, stageIndex: number, waveNumber: number, totalWaves = 10) {
  const p = readProgress();
  const slot = p.byDiff[diff];
  const prev = slot.waves[stageIndex] ?? 0;
  const n = Math.max(prev, Math.min(totalWaves, waveNumber));
  slot.waves[stageIndex] = n;
  if (n >= totalWaves) slot.unlocked = Math.max(slot.unlocked, stageIndex + 1);
  writeProgress(p);
  if (diff === 'normal') {
    try {
      localStorage.setItem(STAGE_KEY, String(slot.unlocked));
    } catch {
      /* ignore */
    }
  }
}

/** On stage loss, remember how far they got (waves cleared = died on wave `diedOnWave`). */
export function recordStageLoss(diff: Difficulty, stageIndex: number, diedOnWave: number) {
  const cleared = Math.max(0, Math.min(9, diedOnWave - 1));
  if (cleared <= 0) return;
  const p = readProgress();
  const prev = p.byDiff[diff].waves[stageIndex] ?? 0;
  if (cleared > prev) {
    p.byDiff[diff].waves[stageIndex] = cleared;
    writeProgress(p);
  }
}

export function unlockStage(index: number): number {
  return setUnlockedFor(getDifficulty(), index);
}

export function unlockStageFor(diff: Difficulty, index: number): number {
  return setUnlockedFor(diff, index);
}

export function getDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    return v === 'easy' || v === 'hard' ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function setDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(DIFF_KEY, d);
  } catch {
    /* ignore */
  }
}
