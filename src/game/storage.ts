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
const DIFF_KEY = 'bracket-bastion.difficulty';
const MAX = 8;

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

/** Highest stage index (0-based) the player may start from. */
export function getUnlocked(): number {
  try {
    const n = Number(localStorage.getItem(STAGE_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function unlockStage(index: number): number {
  const n = Math.max(getUnlocked(), index);
  try {
    localStorage.setItem(STAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
  return n;
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
