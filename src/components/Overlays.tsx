import { useEffect, useState, type CSSProperties } from 'react';
import {
  BIG_DEBT,
  DIFFS,
  DIFF_ORDER,
  STAGES,
  DEMO_ALL_STAGES,
  TEST_UNLOCK_ALL,
  TOWERS,
  TOWER_ORDER,
  diffSummary,
  type CampaignPerk,
  type Difficulty,
} from '../game/config';
import type { Result } from '../game/engine';
import { cleanName, type ScoreEntry } from '../game/storage';
import { cn } from '../utils/cn';
import { LockIcon, MusicIcon } from './Icons';
import TowerIcon from './TowerIcon';

const fmt = (n: number) => n.toLocaleString('en-US');
const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);

// ── high-score table ──────────────────────────────────────────
export function ScoreTable({ scores, highlight, limit = 8 }: { scores: ScoreEntry[]; highlight?: string; limit?: number }) {
  if (!scores.length) {
    return <p className="px-3 py-4 text-[15px] text-ink/60">No scores yet.</p>;
  }
  return (
    <ol>
      {scores.slice(0, limit).map((s, i) => {
        const stage = s.stage ?? 1;
        const cleared = s.won && stage >= STAGES.length;
        const d = s.diff ?? 'normal';
        return (
          <li
            key={s.id}
            className={cn(
              'grid grid-cols-[2ch_minmax(0,1fr)_auto_7ch] items-center gap-3 border-b border-ink/10 px-3 py-1.5 font-mono text-sm last:border-b-0',
              s.id === highlight && 'bg-cash/15 text-cash',
            )}
          >
            <span className="text-ink/50">{i + 1}</span>
            <span className="truncate">{s.name}</span>
            <span className={cn('text-[11px] tracking-wider', s.won ? (s.perfect ? 'text-mint' : 'text-cash') : 'text-alert')}>
              {d !== 'normal' && <b className={cn('mr-1.5 font-normal', d === 'hard' ? 'text-alert' : 'text-mint')}>{DIFFS[d].name}</b>}
              S{stage} · {cleared ? 'DONE' : s.won ? (s.perfect ? 'PERFECT' : 'CLEAR') : `LOSS W${s.wave}`}
            </span>
            <span className="text-right">{fmt(s.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ── start screen ──────────────────────────────────────────────
// Deliberately sparse: title, one sentence, a stage picker and the start button.
// Everything else lives behind "How to play".
export function StartScreen({
  scores,
  stage,
  unlocked,
  musicOn,
  diff,
  onStage,
  onDiff,
  onMusic,
  onInfo,
  onStart,
}: {
  scores: ScoreEntry[];
  stage: number;
  unlocked: number;
  musicOn: boolean;
  diff: Difficulty;
  onStage: (index: number) => void;
  onDiff: (d: Difficulty) => void;
  onMusic: () => void;
  onInfo: () => void;
  onStart: () => void;
}) {
  const def = STAGES[stage];
  const atNewest = stage >= unlocked;
  const moreLocked = unlocked < STAGES.length - 1;

  return (
    <div className="overlay overlay-title">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-6 md:px-8 short:py-3">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)] md:items-end md:gap-12 short:gap-5">
          <section className="min-w-0">
            {(TEST_UNLOCK_ALL || DEMO_ALL_STAGES) && (
              <div className="sheet-meta short:hidden">
                {TEST_UNLOCK_ALL && <span className="text-mint">TEST MODE</span>}
                {!TEST_UNLOCK_ALL && DEMO_ALL_STAGES && <span className="text-mint">DEMO — all stages</span>}
              </div>
            )}
            <h1 className="title mt-3 short:mt-0">
              <span className="text-cash">[</span>BRACKET{' '}
              <br />
              BASTION<span className="text-cash">]</span>
            </h1>
            <p className="mt-4 max-w-lg text-[17px] leading-snug text-ink/85 md:text-xl short:mt-2 short:max-w-none short:text-[16px]" style={{ animation: 'rise .5s .15s ease both' }}>
              Tower defense on a tax-themed map. Build towers beside the path and stop enemies from reaching your gate.
            </p>

            <div className="pick-row mt-6 short:mt-3" style={{ animation: 'rise .5s .2s ease both' }}>
              <div className="min-w-0">
                <div className="stage-pick" role="group" aria-label="Stage select" style={{ '--sw': def.theme.glow, '--sp': def.theme.paper } as CSSProperties}>
                  <button type="button" className="stage-arrow" onClick={() => onStage(stage - 1)} disabled={stage === 0} aria-label="Previous stage">
                    ◂
                  </button>
                  <div className="stage-body" aria-live="polite">
                    <div className="stage-kicker">STAGE {pad2(stage + 1)}</div>
                    <div className="stage-title">{def.name}</div>
                  </div>
                  <button
                    type="button"
                    className="stage-arrow"
                    onClick={() => onStage(stage + 1)}
                    disabled={atNewest}
                    aria-label={atNewest && moreLocked ? 'Next stage is locked — win this stage to unlock it' : 'Next stage'}
                  >
                    {atNewest && moreLocked ? <LockIcon /> : '▸'}
                  </button>
                </div>
                <p className="stage-blurb">
                  {def.blurb}
                  {atNewest && moreLocked && <span className="text-ink/50"> Clear this stage to unlock the next.</span>}
                </p>
              </div>

              <div className="min-w-0">
                <div className="diff-pick" role="radiogroup" aria-label="Difficulty">
                  {DIFF_ORDER.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={d === diff} className={cn('diff-btn', `is-${d}`)} onClick={() => onDiff(d)}>
                      {DIFFS[d].name}
                    </button>
                  ))}
                </div>
                <p className="stage-blurb" aria-live="polite">
                  {diffSummary(diff)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-stretch gap-3 short:mt-3" style={{ animation: 'rise .5s .25s ease both' }}>
              <button type="button" className="btn btn-primary btn-xl w-full sm:w-auto" onClick={onStart} style={{ animation: 'cta 1.4s ease-in-out infinite' }}>
                Play <kbd>ENTER</kbd>
              </button>
              <button type="button" className="btn min-h-14 flex-1 sm:flex-none" onClick={onInfo}>
                How to play <kbd>I</kbd>
              </button>
              <button
                type="button"
                className={cn('btn btn-icon min-h-14 w-14', !musicOn && 'is-off')}
                onClick={onMusic}
                aria-pressed={musicOn}
                aria-label={musicOn ? 'Turn stage music off' : 'Turn stage music on'}
                title="Stage music (T)"
              >
                <MusicIcon off={!musicOn} />
              </button>
            </div>
          </section>

          <section className="min-w-0" style={{ animation: 'rise .5s .3s ease both' }}>
            <div className="panel">
              <div className="panel-title">
                <span>High scores</span>
                <span className="font-mono tracking-normal text-ink/45">TOP 5</span>
              </div>
              <ScoreTable scores={scores} limit={5} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── how to play (opened from the title, the HUD info button, or the pause menu) ──
// The full briefing as it originally appeared on the home screen: the mission,
// the shelter schedule with each shelter's own icon, and the controls.
const KEYS: [string, string][] = [
  ['1–5', 'pick tower'],
  ['ARROWS / WASD', 'move cursor'],
  ['SPACE', 'build · select'],
  ['U / X', 'upgrade · sell'],
  ['N', 'send wave early'],
  ['F · P', 'speed · pause'],
  ['T · M', 'music · mute all'],
  ['I', 'this sheet'],
];

export function InfoOverlay({ stage, paused, closeLabel, onClose }: { stage: number; paused: boolean; closeLabel: string; onClose: () => void }) {
  const plate = STAGES[stage].theme.plate;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-6 lg:max-w-5xl short:py-3">
        <div className="panel">
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
            <div className="min-w-0">
              {paused && <div className="sheet-meta">PAUSED</div>}
              <h2 className="mt-1 font-stencil text-4xl leading-none">HOW TO PLAY</h2>
            </div>
            <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="info-body" role="region" aria-label="Instructions" tabIndex={0}>
            <div className="info-brief">
              <p className="max-w-xl text-[17px] leading-snug text-ink/85 lg:text-[19px]">
                Place towers on tiles next to the path. Each enemy that reaches your gate drains your{' '}
                <span className="text-cash">life</span> bar. Clear 10 waves to finish the stage — keep life above zero.
              </p>
              <p className="mt-3 font-mono text-xs tracking-wider text-ink/60">10 WAVES PER STAGE · 1 FREE TOWER TO START</p>
            </div>

            <div className="panel info-schedule">
              <div className="panel-title">
                <span>Towers</span>
                <span className="font-mono tracking-normal text-ink/45">1–5</span>
              </div>
              <ul>
                {TOWER_ORDER.map((type) => {
                  const d = TOWERS[type];
                  return (
                    <li key={type} className="flex items-center gap-3 border-b border-ink/10 px-3 py-2 last:border-b-0">
                      <TowerIcon type={type} size={38} plate={plate} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 text-[15px] leading-tight font-bold tracking-widest uppercase" style={{ color: d.color }}>
                          {d.name}
                          <span className="font-mono text-[11px] font-normal tracking-normal text-cash">${d.levels[0].cost}</span>
                        </div>
                        <div className="text-sm leading-tight text-ink/75">{d.tagline}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-dashed border-ink/25 px-3 py-2 text-[13px] leading-snug text-ink/65">
                <span className="text-cash">Shelters</span> hit harder on tough enemies. <span className="text-credit">Credits</span> deal flat
                damage. Big kills (${BIG_DEBT}+ HP) pay bonus cash. Upgrades matter.
              </div>
            </div>

            <div className="info-controls">
              <p className="text-sm tracking-wide text-ink/70 uppercase">
                <span className="hint-touch">Tap a tile to build · press, drag &amp; release to aim · tap a shelter to upgrade</span>
                <span className="hint-mouse">Click a tile to build · press, drag &amp; release to aim · click a shelter to upgrade</span>
              </p>
              <div className="kb-only mt-4">
                <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm text-ink/75 sm:grid-cols-2" aria-label="Keyboard controls">
                  {KEYS.map(([k, v]) => (
                    <li key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink/20 pb-1">
                      <span className="font-mono text-xs text-cash">{k}</span>
                      <span className="tracking-wide uppercase">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-ink/25 p-4">
            <button type="button" className="btn btn-primary btn-xl w-full" onClick={onClose}>
              {closeLabel} <kbd>ESC</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── pause ─────────────────────────────────────────────────────
export function PauseOverlay({
  muted,
  musicOn,
  onResume,
  onRestart,
  onQuit,
  onMute,
  onMusic,
  onInfo,
}: {
  muted: boolean;
  musicOn: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onMute: () => void;
  onMusic: () => void;
  onInfo: () => void;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Game paused">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6">
        <div className="panel p-5">
          <h2 className="font-stencil text-5xl leading-none">PAUSED</h2>
          <div className="mt-5 grid gap-2.5">
            <button type="button" className="btn btn-primary btn-xl" onClick={onResume}>
              Resume <kbd>P</kbd>
            </button>
            <button type="button" className="btn min-h-12" onClick={onInfo}>
              How to play <kbd>I</kbd>
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn px-2" onClick={onMusic} aria-pressed={musicOn}>
                ♪ Music {musicOn ? 'on' : 'off'} <kbd>T</kbd>
              </button>
              <button type="button" className="btn px-2" onClick={onMute} aria-pressed={!muted}>
                Sound {muted ? 'off' : 'on'} <kbd>M</kbd>
              </button>
              <button type="button" className="btn px-2" onClick={onRestart}>
                Restart <kbd>R</kbd>
              </button>
              <button type="button" className="btn px-2" onClick={onQuit}>
                Quit <kbd>Q</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── campaign perk (stages 10 & 20) ────────────────────────────
const PERK_OPTS: { id: CampaignPerk; title: string; blurb: string }[] = [
  {
    id: 'liquidity',
    title: 'Liquidity',
    blurb: '+18% tower damage for the rest of the run.',
  },
  {
    id: 'shelter',
    title: 'Tax shelters',
    blurb: 'Stronger slows and occasional freezes near towers.',
  },
  {
    id: 'wildcard',
    title: 'Wildcard',
    blurb: 'Random cash, shield, or hazards during waves.',
  },
];

export function CampaignPerkOverlay({ stageIndex, onPick }: { stageIndex: number; onPick: (p: CampaignPerk) => void }) {
  const def = STAGES[stageIndex];
  return (
    <div className="overlay overlay-perk" role="dialog" aria-modal="true" aria-label="Choose campaign strategy">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-6">
        <div className="panel">
          <div className="px-4 pt-4 pb-2">
            <div className="sheet-meta">STAGE {pad2(stageIndex + 1)} · {def.name}</div>
            <h2 className="mt-1 font-stencil text-3xl leading-tight md:text-4xl">Pick a run bonus</h2>
            <p className="mt-3 text-[16px] leading-snug text-ink/85">Stays active until you start a new campaign.</p>
          </div>
          <div className="perk-grid grid gap-3 px-4 pb-4 md:grid-cols-3">
            {PERK_OPTS.map((p) => (
              <button key={p.id} type="button" className="btn perk-opt" onClick={() => onPick(p.id)}>
                <span className="perk-opt-title">{p.title}</span>
                <span className="perk-opt-blurb">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── game over / victory ───────────────────────────────────────
function useCountUp(target: number, ms: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function ResultOverlay({
  result,
  entry,
  scores,
  onNext,
  onRestart,
  onNewRun,
  onQuit,
  onRename,
}: {
  result: Result;
  entry: ScoreEntry | null;
  scores: ScoreEntry[];
  /** present when there is another stage to move on to */
  onNext: (() => void) | null;
  onRestart: () => void;
  onNewRun: () => void;
  onQuit: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(entry?.name ?? 'YOU');
  const shown = useCountUp(result.score, 1200);
  const rank = entry ? scores.findIndex((s) => s.id === entry.id) + 1 : 0;
  const stageNo = result.stage + 1;
  const nextName = onNext ? STAGES[result.stage + 1].name : '';

  const tone = result.perfect ? 'text-mint' : result.won ? 'text-cash' : 'text-alert';
  const title = result.perfect ? 'PERFECT' : result.won ? 'STAGE CLEAR' : 'DEFEATED';
  const tail = result.final ? 'Campaign complete.' : `Stage ${stageNo + 1} unlocked${nextName ? `: ${nextName}` : ''}.`;
  const sub = result.perfect
    ? `No damage to your gate. ${tail}`
    : result.won
      ? `$${fmt(result.bill)} leaked through, but you held the gate. ${tail}`
      : `Life hit zero on wave ${result.wave} of stage ${stageNo}.`;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-4 px-4 py-6">
        <div className="pt-2 text-center">
          <div className="sheet-meta mb-5">
            STAGE {pad2(stageNo)} · {STAGES[result.stage].name} · {DIFFS[result.diff].name}
          </div>
          <div className={cn('stamp', tone)}>{title}</div>
          <p className="mt-5 text-lg leading-snug text-ink/85">{sub}</p>
        </div>

        <div className="panel" style={{ animation: 'rise .4s .15s ease both' }}>
          <div className="panel-title">
            <span>Score breakdown</span>
            {rank === 1 && <span className="text-cash">★ New record</span>}
          </div>
          <ul className="px-3 py-1">
            {result.lines.map((l) => (
              <li key={l.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink/15 py-1.5 last:border-b-0">
                <span className="min-w-0">
                  <span className="text-[15px] font-semibold tracking-wider uppercase">{l.label}</span>
                  {l.note && <span className="ml-2 text-[13px] text-ink/55">{l.note}</span>}
                </span>
                <span className="font-mono text-[15px]">{fmt(l.value)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-end justify-between gap-3 border-t border-ink/30 px-3 py-3">
            <span className="text-sm font-bold tracking-[0.22em] text-ink/70 uppercase">Total</span>
            <span className={cn('font-mono text-4xl leading-none md:text-5xl', tone)}>{fmt(shown)}</span>
          </div>
        </div>

        {onNext ? (
          <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5" style={{ animation: 'rise .4s .2s ease both' }}>
            <button type="button" className="btn btn-primary btn-xl px-3 text-[18px]" onClick={onNext} style={{ animation: 'cta 1.4s ease-in-out infinite' }}>
              Next stage ▸ <kbd>ENTER</kbd>
            </button>
            <button type="button" className="btn min-h-14 px-2" onClick={onRestart}>
              Replay <kbd>R</kbd>
            </button>
            <button type="button" className="btn min-h-14 px-2" onClick={onQuit}>
              Home
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3" style={{ animation: 'rise .4s .2s ease both' }}>
            {result.won ? (
              <button type="button" className="btn btn-primary btn-xl px-3" onClick={onNewRun}>
                New campaign <kbd>ENTER</kbd>
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-xl" onClick={onRestart}>
                Try again <kbd>R</kbd>
              </button>
            )}
            <button type="button" className="btn btn-xl" onClick={onQuit}>
              {result.won ? 'Home' : 'Quit'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3" style={{ animation: 'rise .4s .26s ease both' }}>
          <label htmlFor="bb-name" className="text-sm font-bold tracking-[0.2em] text-ink/70 uppercase">
            Name
          </label>
          <input
            id="bb-name"
            className="name-input"
            value={name}
            maxLength={10}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Your name for the high-score table"
            onChange={(e) => {
              const v = cleanName(e.target.value);
              setName(v);
              onRename(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
          />
        </div>

        <div className="panel mb-2" style={{ animation: 'rise .4s .32s ease both' }}>
          <div className="panel-title">
            <span>High scores</span>
            {rank > 0 ? <span className="font-mono tracking-normal text-cash">RANK #{rank}</span> : <span className="font-mono tracking-normal text-ink/45">NOT RANKED</span>}
          </div>
          <ScoreTable scores={scores} highlight={entry?.id} limit={5} />
        </div>
      </div>
    </div>
  );
}
