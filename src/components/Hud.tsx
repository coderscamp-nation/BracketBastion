import { useEffect, useRef } from 'react';
import { DIFFS } from '../game/config';
import type { Hud as HudState } from '../game/engine';
import { cn } from '../utils/cn';
import { InfoIcon, MusicIcon, PauseIcon, SoundIcon } from './Icons';

interface Props {
  hud: HudState;
  speed: number;
  muted: boolean;
  musicOn: boolean;
  onMusic: () => void;
  onSend: () => void;
  /** next speed, or the previous one when `back` is set */
  onSpeed: (back: boolean) => void;
  onPause: () => void;
  onMute: () => void;
  onInfo: () => void;
}

const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
const fmt = (n: number) => n.toLocaleString('en-US');
/** Keeps stat chips from clipping on phones: 56,102 → 56.1K */
const compact = (n: number) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'K' : fmt(n));

function Stat({ label, num, text, tone, bar, danger }: { label: string; num: number; text: string; tone: string; bar?: number; danger?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(num);

  // Punch the number whenever it changes: bright pop on gains, red pop on losses.
  useEffect(() => {
    const d = num - prev.current;
    prev.current = num;
    const el = ref.current;
    if (!d || !el || typeof el.animate !== 'function') return;
    el.animate(
      d > 0
        ? [{ transform: 'scale(1.22)', filter: 'brightness(1.7)' }, { transform: 'scale(1)', filter: 'brightness(1)' }]
        : [{ transform: 'scale(1.2)', color: '#ff5a4a' }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'ease-out' },
    );
  }, [num]);

  return (
    <div className={cn('stat', tone, danger && 'is-danger')}>
      <span className="stat-label">{label}</span>
      <span ref={ref} className="stat-value">
        {text}
      </span>
      {bar !== undefined && <span className="stat-bar" style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%` }} />}
    </div>
  );
}

export default function Hud({ hud, speed, muted, musicOn, onMusic, onSend, onSpeed, onPause, onMute, onInfo }: Props) {
  const building = hud.phase === 'build';
  const ratio = hud.earnings / hud.maxEarnings;

  return (
    <header className="hud">
      <div className="hud-stats">
        <Stat label="Life" num={hud.earnings} text={`$${fmt(hud.earnings)}`} tone="text-ink" bar={ratio} danger={ratio < 0.3} />
        <Stat label="Shield" num={hud.shield} text={fmt(hud.shield)} tone="text-mint" />
        <Stat label="Cash" num={hud.gold} text={`$${fmt(hud.gold)}`} tone="text-cash" />
        <Stat label="Vault" num={hud.vault} text={`$${compact(hud.vault)}`} tone="text-cash" />
        <Stat label="Score" num={hud.score} text={hud.score >= 1000000 ? compact(hud.score) : fmt(hud.score)} tone="text-ink" />
      </div>

      <div className="hud-wave">
        <div className="wave-info">
          <div className="wave-no">
            S{hud.stage}
            {hud.diff !== 'normal' && <span className={hud.diff === 'hard' ? 'text-alert' : 'text-mint'}> {DIFFS[hud.diff].name}</span>} · {building ? 'NEXT' : 'WAVE'} {pad2(hud.wave)}/{pad2(hud.waves)}
            {!building && hud.left > 0 ? ` · ${hud.left} LEFT` : ''}
          </div>
          <div className="wave-name">{hud.name}</div>
        </div>

        <div className="hud-btns">
          {building && (
            <button type="button" className="btn btn-primary btn-send" onClick={onSend} aria-label={`Send next wave now, ${hud.countdown} seconds left`}>
              SEND <span>{hud.countdown}</span>
              <kbd>N</kbd>
            </button>
          )}
          <button
            type="button"
            className={cn('btn btn-icon btn-speed', speed > 1 && 'is-on')}
            onClick={(e) => onSpeed(e.shiftKey)}
            aria-label={`Game speed ${speed}×. Press to change.`}
            title="Speed 1–4× (F · Shift+F to slow down)"
          >
            {speed}×
            <span className="speed-pips" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <i key={n} className={n <= speed ? 'on' : undefined} />
              ))}
            </span>
          </button>
          <button type="button" className="btn btn-icon" onClick={onPause} aria-label="Pause" title="Pause (P)">
            <PauseIcon />
          </button>
          <button
            type="button"
            className={cn('btn btn-icon btn-music', !musicOn && 'is-off')}
            onClick={onMusic}
            aria-pressed={musicOn}
            aria-label={musicOn ? 'Turn stage music off' : 'Turn stage music on'}
            title="Stage music (T)"
          >
            <MusicIcon off={!musicOn} />
          </button>
          <button type="button" className="btn btn-icon btn-mute" onClick={onMute} aria-pressed={muted} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title="Sound (M)">
            <SoundIcon off={muted} />
          </button>
          <button type="button" className="btn btn-icon btn-info" onClick={onInfo} aria-label="How to play and controls — pauses the game" title="How to play (I)">
            <InfoIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
