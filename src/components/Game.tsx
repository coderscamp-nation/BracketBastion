import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { music, sfx } from '../game/audio';
import {
  DEMO_ALL_STAGES,
  DIFF_ORDER,
  STAGES,
  TEST_CAMPAIGN_PERKS,
  TEST_UNLOCK_ALL,
  TOWERS,
  TOWER_ORDER,
  isPerkStage,
  maxUnlockedStageIndex,
  type CampaignPerk,
  type Difficulty,
  type TowerType,
} from '../game/config';
import { Engine, type Hud as HudState, type Result } from '../game/engine';
import { Renderer } from '../game/render';
import { getDifficulty, getUnlocked, loadScores, renameScore, saveRun, setDifficulty, unlockStage, type ScoreEntry } from '../game/storage';
import { cn } from '../utils/cn';
import Dock from './Dock';
import Hud from './Hud';
import { CampaignPerkOverlay, InfoOverlay, PauseOverlay, ResultOverlay, StartScreen } from './Overlays';

type Mode = 'title' | 'play';

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* haptics unavailable */
  }
}

/** Recolours the page chrome (HUD, dock, overlays) to match a stage's sheet. */
function applyTheme(stage: number) {
  const t = STAGES[stage].theme;
  const root = document.documentElement.style;
  root.setProperty('--paper', t.paper);
  root.setProperty('--deep', t.deep);
  root.setProperty('--chip', t.chip);
  root.setProperty('--hover', t.hover);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.paper);
}

const lastStage = STAGES.length - 1;
const MAX_SPEED = 4;

const initialUnlocked = () => {
  const test = maxUnlockedStageIndex();
  return test >= 0 ? test : Math.min(getUnlocked(), lastStage);
};

/** Demo unlocks every stage but should not default the picker to stage 20 (perk gate + confusing start). */
const initialStageSel = () => (DEMO_ALL_STAGES ? 0 : Math.min(getUnlocked(), lastStage));

export default function Game() {
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const endTimer = useRef(0);
  const pressing = useRef(false);
  /** The campaign in progress: which stage, the score carried into it, and its line in the score table. */
  const run = useRef<{ stage: number; carry: number; id: string | null; diff: Difficulty; perks: Partial<Record<number, CampaignPerk>> }>({
    stage: 0,
    carry: 0,
    id: null,
    diff: 'normal',
    perks: {},
  });

  const [mode, setMode] = useState<Mode>('title');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(sfx.muted);
  const [musicOn, setMusicOn] = useState(music.enabled);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [entry, setEntry] = useState<ScoreEntry | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [toast, setToast] = useState<{ type: TowerType; n: number } | null>(null);
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [stageSel, setStageSel] = useState(initialStageSel);
  /**
   * The "How to play" sheet. 'title' = opened from the home screen, 'resume' = opened mid-game
   * (the game was paused for it and resumes on close), 'pause' = opened from the pause menu.
   */
  const [info, setInfo] = useState<null | 'title' | 'resume' | 'pause'>(null);
  const [perkGate, setPerkGate] = useState<null | { stage: number; carry: number; sameRun: boolean; diff: Difficulty }>(null);

  // Mirror of React state for the RAF loop and global listeners.
  const [diff, setDiff] = useState<Difficulty>(() => getDifficulty());

  const live = useRef({ mode, paused, speed, over: false, stageSel, unlocked, info, diff });
  live.current = { mode, paused, speed, over: !!result, stageSel, unlocked, info, diff };

  const sync = useCallback(() => {
    const g = engineRef.current;
    if (g) setHud(g.snapshot());
  }, []);

  // ── campaign flow ───────────────────────────────────────────
  const begin = useCallback((stage: number, carry: number, sameRun: boolean, level: Difficulty, skipPerkGate = false) => {
    const g = engineRef.current;
    if (!g) return;
    if (!TEST_UNLOCK_ALL && !skipPerkGate && isPerkStage(stage) && run.current.perks[stage] === undefined) {
      sfx.unlock();
      setPerkGate({ stage, carry, sameRun, diff: level });
      setResult(null);
      setInfo(null);
      setPaused(false);
      return;
    }
    window.clearTimeout(endTimer.current);
    sfx.unlock();
    if (!sameRun) {
      run.current.id = null;
      run.current.perks = {};
    }
    run.current.stage = stage;
    run.current.carry = carry;
    run.current.diff = level;
    // every stage begins at normal speed, however fast the last one was running
    live.current.speed = 1;
    setSpeed(1);
    const perks = TEST_UNLOCK_ALL ? [...TEST_CAMPAIGN_PERKS] : Object.values(run.current.perks);
    g.reset(false, stage, carry, level, perks);
    applyTheme(stage);
    music.play(stage);
    setResult(null);
    setEntry(null);
    setToast(null);
    setInfo(null);
    setPerkGate(null);
    setPaused(false);
    setMode('play');
    setHud(g.snapshot());
    sfx.play('start');
  }, []);

  const chooseCampaignPerk = useCallback(
    (perk: CampaignPerk) => {
      const gate = perkGate;
      if (!gate) return;
      run.current.perks[gate.stage] = perk;
      begin(gate.stage, gate.carry, gate.sameRun, gate.diff, true);
    },
    [begin, perkGate],
  );

  /** Title screen → the selected stage, as a fresh campaign. */
  const startSelected = useCallback(() => begin(live.current.stageSel, 0, false, live.current.diff), [begin]);
  /** Same stage again, keeping whatever score was carried into it. */
  const retry = useCallback(() => begin(run.current.stage, run.current.carry, true, run.current.diff), [begin]);
  const newRun = useCallback(() => begin(0, 0, false, run.current.diff), [begin]);
  const nextStage = useCallback(() => {
    const r = engineRef.current?.result;
    if (r && r.won && !r.final) begin(r.stage + 1, r.score, true, run.current.diff);
  }, [begin]);

  const chooseStage = useCallback((index: number) => {
    const g = engineRef.current;
    const L = live.current;
    if (!g || L.mode !== 'title' || index < 0 || index > L.unlocked || index === L.stageSel) return;
    sfx.unlock();
    sfx.play('select');
    g.reset(true, index);
    applyTheme(index);
    setStageSel(index);
  }, []);

  /** Home screen only: the difficulty applies to the campaign started from there. */
  const chooseDiff = useCallback((level: Difficulty) => {
    const L = live.current;
    if (L.mode !== 'title' || level === L.diff) return;
    sfx.unlock();
    sfx.play('select');
    setDifficulty(level);
    setDiff(level);
  }, []);

  const quit = useCallback(() => {
    const g = engineRef.current;
    if (!g) return;
    window.clearTimeout(endTimer.current);
    music.stop();
    // come back to the title on the furthest sheet available, ready to continue
    const sel = Math.min(Math.max(run.current.stage, getUnlocked()), lastStage);
    g.reset(true, sel);
    applyTheme(sel);
    setStageSel(sel);
    setResult(null);
    setInfo(null);
    setPaused(false);
    setMode('title');
    setScores(loadScores());
  }, []);

  const togglePause = useCallback(() => {
    const L = live.current;
    if (L.mode !== 'play' || L.over || engineRef.current?.result) return;
    sfx.unlock();
    sfx.play('pause');
    setPaused(!L.paused);
  }, []);

  const autoPause = useCallback(() => {
    const L = live.current;
    if (L.mode === 'play' && !L.paused && !L.over && !engineRef.current?.result) setPaused(true);
  }, []);

  /** Steps the game speed 1× → 2× → 3× → 4× → 1× (or backwards). */
  const cycleSpeed = useCallback((back = false) => {
    const L = live.current;
    if (L.mode !== 'play') return;
    sfx.play('select');
    const next = ((L.speed - 1 + (back ? MAX_SPEED - 1 : 1)) % MAX_SPEED) + 1;
    L.speed = next; // keep the mirror in step so quick repeat presses never skip or repeat a speed
    setSpeed(next);
  }, []);

  const toggleMute = useCallback(() => {
    const m = !sfx.muted;
    sfx.unlock();
    sfx.setMuted(m);
    setMuted(m);
  }, []);

  const toggleMusic = useCallback(() => {
    const on = !music.enabled;
    sfx.unlock();
    music.setEnabled(on);
    setMusicOn(on);
  }, []);

  /** Opens "How to play". Mid-game this pauses the action; closing the sheet resumes it. */
  const openInfo = useCallback(() => {
    const L = live.current;
    if (L.info) return;
    if (L.mode === 'play' && (L.over || engineRef.current?.result)) return;
    sfx.unlock();
    sfx.play('select');
    if (L.mode === 'title') setInfo('title');
    else if (L.paused) setInfo('pause');
    else {
      setPaused(true);
      setInfo('resume');
    }
  }, []);

  const closeInfo = useCallback(() => {
    const L = live.current;
    if (!L.info) return;
    sfx.play('select');
    if (L.info === 'resume') setPaused(false);
    setInfo(null);
  }, []);

  const send = useCallback(() => {
    engineRef.current?.sendWave();
    sync();
  }, [sync]);

  /** Briefly explains the picked shelter on layouts where the inspector strip is not visible. */
  const flash = useCallback((type: TowerType) => setToast({ type, n: Date.now() }), []);

  const pick = useCallback(
    (type: TowerType) => {
      sfx.unlock();
      engineRef.current?.setBuild(type);
      flash(type);
      sync();
    },
    [sync, flash],
  );

  const close = useCallback(() => {
    const g = engineRef.current;
    if (g) g.selected = null;
    sync();
  }, [sync]);

  const upgrade = useCallback(() => {
    const g = engineRef.current;
    if (g) g.upgrade(g.selected);
    sync();
  }, [sync]);

  const sell = useCallback(() => {
    const g = engineRef.current;
    if (g) g.sell(g.selected);
    sync();
  }, [sync]);

  const rename = useCallback(
    (name: string) => {
      if (entry) setScores(renameScore(entry.id, name));
    },
    [entry],
  );

  const actions = useRef({ startSelected, retry, newRun, nextStage, chooseStage, chooseDiff, quit, togglePause, autoPause, cycleSpeed, toggleMute, toggleMusic, openInfo, closeInfo, sync, flash });
  actions.current = { startSelected, retry, newRun, nextStage, chooseStage, chooseDiff, quit, togglePause, autoPause, cycleSpeed, toggleMute, toggleMusic, openInfo, closeInfo, sync, flash };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // The stage tune goes quiet while paused and picks up again on resume.
  useEffect(() => {
    music.hold(paused);
  }, [paused]);

  // ── engine + render loop ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const engine = new Engine();
    engine.reset(true, live.current.stageSel); // attract mode plays behind the title screen
    applyTheme(live.current.stageSel);
    const renderer = new Renderer(canvas);
    engineRef.current = engine;
    rendererRef.current = renderer;

    engine.sfx = (name) => {
      if (engine.attract) return;
      sfx.play(name);
      if (name === 'leak') buzz(70);
      else if (name === 'boom') buzz(35);
    };
    engine.onEnd = (r) => {
      const saved = saveRun(run.current.id, { score: r.score, wave: r.wave, won: r.won, perfect: r.perfect, stage: r.stage + 1, diff: r.diff });
      run.current.id = saved.entry.id;
      setEntry(saved.entry);
      setScores(saved.list);
      if (r.won && !r.final) setUnlocked(Math.min(unlockStage(r.stage + 1), lastStage));
      music.stop();
      buzz(r.won ? [40, 60, 40, 60, 140] : 320);
      endTimer.current = window.setTimeout(() => {
        engine.banner = null; // the DOM result sheet takes over from the canvas stamp
        setResult(r);
      }, r.won ? 3400 : 1800);
    };

    const fit = () => renderer.resize(board.clientWidth, board.clientHeight);
    const ro = new ResizeObserver(fit);
    ro.observe(board);
    fit();
    void document.fonts?.ready.then(() => renderer.repaint());

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let key = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const L = live.current;
      if (!L.paused) {
        const fast = L.mode === 'play' && !engine.result;
        let rem = dt * (fast ? L.speed : 1);
        while (rem > 1e-5) {
          const s = Math.min(rem, 1 / 45);
          engine.step(s);
          rem -= s;
        }
      }
      renderer.draw(engine, now / 1000);
      if (!engine.attract && now - hudAt > 90) {
        hudAt = now;
        music.setIntensity(engine.phase === 'wave' ? 1 : 0);
        const k = engine.hudKey();
        if (k !== key) {
          key = k;
          setHud(engine.snapshot());
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.clearTimeout(endTimer.current);
      music.stop();
      engineRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // ── keyboard ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const g = engineRef.current;
      if (!g) return;
      const A = actions.current;
      const L = live.current;
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

      // In menus, a keyboard-focused button should activate normally instead of triggering a shortcut.
      const inMenu = L.mode === 'title' || L.paused || L.over || !!L.info;
      if (inMenu && tag === 'BUTTON' && (k === 'Enter' || k === ' ')) return;

      if (k === 'm') {
        A.toggleMute();
        return;
      }
      if (k === 't') {
        A.toggleMusic();
        return;
      }
      if (L.info) {
        if (k === 'Escape' || k === 'i' || k === '?' || k === 'Enter' || k === ' ') {
          ev.preventDefault();
          A.closeInfo();
        }
        return;
      }
      if (k === 'i' || k === '?') {
        A.openInfo();
        return;
      }

      if (L.mode === 'title') {
        if (k === 'Enter' || k === ' ') {
          ev.preventDefault();
          A.startSelected();
        } else if (k === 'ArrowRight' || k === 'd') {
          ev.preventDefault();
          A.chooseStage(L.stageSel + 1);
        } else if (k === 'ArrowLeft' || k === 'a') {
          ev.preventDefault();
          A.chooseStage(L.stageSel - 1);
        } else if (k === 'ArrowUp' || k === 'w' || k === 'ArrowDown' || k === 's') {
          // ↑ harder, ↓ easier
          ev.preventDefault();
          const next = DIFF_ORDER[DIFF_ORDER.indexOf(L.diff) + (k === 'ArrowUp' || k === 'w' ? 1 : -1)];
          if (next) A.chooseDiff(next);
        } else if (k.length === 1 && k >= '1' && k <= '9' && Number(k) <= STAGES.length) {
          A.chooseStage(Number(k) - 1);
        }
        return;
      }
      if (L.over || g.result) {
        const r = g.result;
        if (k === 'r') {
          ev.preventDefault();
          A.retry();
        } else if (L.over && r && (k === 'Enter' || k === ' ')) {
          ev.preventDefault();
          if (r.won && !r.final) A.nextStage();
          else if (r.won) A.newRun();
          else A.retry();
        } else if (L.over && (k === 'Escape' || k === 'q')) A.quit();
        return;
      }
      if (L.paused) {
        if (k === 'p' || k === 'Escape' || k === ' ' || k === 'Enter') {
          ev.preventDefault();
          A.togglePause();
        } else if (k === 'r') A.retry();
        else if (k === 'q') A.quit();
        return;
      }

      const move = (sx: number, sy: number) => {
        const p = rendererRef.current?.portrait;
        g.moveCursor(p ? sy : sx, p ? sx : sy);
      };
      const focusTower = () => g.selected ?? (g.cursor.show ? g.towerAt(g.cursor.cx, g.cursor.cy) : null);

      switch (k) {
        case 'ArrowUp':
        case 'w':
          move(0, -1);
          break;
        case 'ArrowDown':
        case 's':
          move(0, 1);
          break;
        case 'ArrowLeft':
        case 'a':
          move(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
          move(1, 0);
          break;
        case ' ':
        case 'Enter':
          if (g.cursor.show) g.tapCell(g.cursor.cx, g.cursor.cy);
          else g.cursor.show = true;
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          g.setBuild(TOWER_ORDER[Number(k) - 1]);
          g.cursor.show = true;
          A.flash(TOWER_ORDER[Number(k) - 1]);
          break;
        case 'u':
          g.upgrade(focusTower());
          break;
        case 'x':
        case 'Delete':
        case 'Backspace':
          g.sell(focusTower());
          break;
        case 'n':
          g.sendWave();
          break;
        case 'f':
          A.cycleSpeed(ev.shiftKey);
          break;
        case 'p':
          A.togglePause();
          break;
        case 'Escape':
          if (g.selected) g.selected = null;
          else A.togglePause();
          break;
        default:
          return;
      }
      ev.preventDefault();
      sfx.unlock();
      A.sync();
    };

    // After a mouse click on a button, drop focus so Space/Enter go back to the board.
    const onClick = (ev: MouseEvent) => {
      const el = document.activeElement;
      if (ev.detail > 0 && el instanceof HTMLButtonElement) el.blur();
    };
    const onVis = () => {
      if (document.hidden) actions.current.autoPause();
    };
    const onBlur = () => actions.current.autoPause();

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ── pointer / touch ─────────────────────────────────────────
  // Press shows a ghost + range, drag re-aims it, release commits. Works the same for mouse and finger.
  const playable = () => {
    const L = live.current;
    return L.mode === 'play' && !L.paused && !L.over && !!engineRef.current && !engineRef.current.result;
  };
  const aim = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = engineRef.current;
    const r = rendererRef.current;
    if (!g || !r) return null;
    const c = r.cellAt(e.clientX, e.clientY);
    if (c) {
      g.cursor.cx = c.cx;
      g.cursor.cy = c.cy;
      g.cursor.show = true;
    } else {
      g.cursor.show = false;
    }
    return c;
  };
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!playable()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sfx.unlock();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    pressing.current = true;
    aim(e);
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!playable()) return;
    if (e.pointerType !== 'mouse' && !pressing.current) return;
    aim(e);
  };
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!pressing.current) return;
    pressing.current = false;
    const g = engineRef.current;
    if (!g || !playable()) return;
    const c = aim(e);
    if (c) g.tapCell(c.cx, c.cy);
    if (e.pointerType !== 'mouse') g.cursor.show = false;
    sync();
  };
  const onLeave = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = engineRef.current;
    if (g && e.pointerType === 'mouse' && !pressing.current) g.cursor.show = false;
  };
  const onCancel = () => {
    pressing.current = false;
    const g = engineRef.current;
    if (g) g.cursor.show = false;
  };

  const playing = mode === 'play' && !!hud;
  const ended = !!hud && (hud.phase === 'won' || hud.phase === 'lost');

  return (
    <div className={cn('game-shell', mode === 'title' && 'is-title')}>
      {playing && hud && (
        <Hud
          hud={hud}
          speed={speed}
          muted={muted}
          musicOn={musicOn}
          onMusic={toggleMusic}
          onSend={send}
          onSpeed={cycleSpeed}
          onPause={togglePause}
          onMute={toggleMute}
          onInfo={openInfo}
        />
      )}

      <div className="board" ref={boardRef}>
        <canvas
          ref={canvasRef}
          aria-label="Bracket Bastion playfield"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onLeave}
          onPointerCancel={onCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
        {playing && hud && hud.built === 0 && !ended && !paused && (
          <div className="hint">
            <span className="hint-mouse">Click a tile beside the path to build · 1–5 to pick</span>
            <span className="hint-touch">Tap a tile beside the path to build</span>
          </div>
        )}
        {playing && hud && !ended && !paused && toast && (
          <div key={toast.n} className="hint hint-note hint-toast" style={{ borderColor: TOWERS[toast.type].color, color: TOWERS[toast.type].color }}>
            <b>{TOWERS[toast.type].short}</b>
          </div>
        )}
        {playing && hud && !ended && !paused && !toast && hud.phase === 'build' && hud.wave > 1 && (
          <div className="hint hint-note hint-intel">
            {hud.tip}
          </div>
        )}
      </div>

      {playing && hud && <Dock hud={hud} onPick={pick} onUpgrade={upgrade} onSell={sell} onClose={close} />}

      {perkGate && <CampaignPerkOverlay stageIndex={perkGate.stage} onPick={chooseCampaignPerk} />}

      {mode === 'title' && !perkGate && (
        <StartScreen
          scores={scores}
          stage={stageSel}
          unlocked={unlocked}
          musicOn={musicOn}
          diff={diff}
          onDiff={chooseDiff}
          onStage={chooseStage}
          onMusic={toggleMusic}
          onInfo={openInfo}
          onStart={startSelected}
        />
      )}
      {mode === 'play' && paused && !result && !info && (
        <PauseOverlay
          muted={muted}
          musicOn={musicOn}
          onResume={togglePause}
          onRestart={retry}
          onQuit={quit}
          onMute={toggleMute}
          onMusic={toggleMusic}
          onInfo={openInfo}
        />
      )}
      {info && (
        <InfoOverlay
          stage={mode === 'title' ? stageSel : (hud?.stage ?? 1) - 1}
          paused={info !== 'title'}
          closeLabel={info === 'resume' ? 'Resume' : info === 'pause' ? 'Back' : 'Got it'}
          onClose={closeInfo}
        />
      )}
      {mode === 'play' && result && (
        <ResultOverlay
          key={`${entry?.id ?? 'result'}-${result.stage}-${result.score}`}
          result={result}
          entry={entry}
          scores={scores}
          onNext={result.won && !result.final ? nextStage : null}
          onRestart={retry}
          onNewRun={newRun}
          onQuit={quit}
          onRename={rename}
        />
      )}
    </div>
  );
}
