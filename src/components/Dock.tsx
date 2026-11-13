import type { CSSProperties } from 'react';
import { STAGES, TOWERS, TOWER_ORDER, type TowerType } from '../game/config';
import type { Hud as HudState } from '../game/engine';
import { cn } from '../utils/cn';
import TowerIcon from './TowerIcon';

interface Props {
  hud: HudState;
  onPick: (type: TowerType) => void;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}

export default function Dock({ hud, onPick, onUpgrade, onSell, onClose }: Props) {
  const sel = hud.sel;
  const build = hud.buildType ? TOWERS[hud.buildType] : null;
  const plate = STAGES[hud.stage - 1].theme.plate;

  return (
    <footer className={cn('dock', sel && 'has-sel')}>
      <div className="dock-info">
        {sel ? (
          <>
            <div className="info-main">
              <div className="info-title" style={{ color: TOWERS[sel.type].color }}>
                <span className="info-name">{TOWERS[sel.type].name}</span>
                <span className="info-tag">LV {sel.level + 1}/{hud.maxTowerLevel}</span>
              </div>
              <div className="info-stats">
                {sel.stats.map((s, i) => (
                  <span key={s.k} className="info-stat">
                    <b>{s.k}</b>
                    {s.v}
                    {sel.next && sel.next[i].v !== s.v && <i> → {sel.next[i].v}</i>}
                  </span>
                ))}
              </div>
            </div>
            <div className="info-actions">
              <button
                type="button"
                className="btn btn-primary btn-stack"
                onClick={onUpgrade}
                disabled={sel.upCost === null || hud.gold < sel.upCost}
                aria-label={sel.upCost === null ? 'Fully upgraded' : `Upgrade for $${sel.upCost}`}
              >
                {sel.upCost === null ? 'MAXED' : 'UPGRADE'}
                <span>{sel.upCost === null ? `★${hud.maxTowerLevel}` : `$${sel.upCost}`}</span>
              </button>
              <button type="button" className="btn btn-stack" onClick={onSell} aria-label={`Sell for $${sel.sell}`}>
                SELL
                <span>+${sel.sell}</span>
              </button>
              <button type="button" className="btn btn-stack info-close" onClick={onClose} aria-label="Close inspector, back to build bar">
                ✕
              </button>
            </div>
          </>
        ) : build ? (
          <div className="info-main">
            <div className="info-title" style={{ color: build.color }}>
              <span className="info-name">{build.name}</span>
              <span className="info-tag">{build.kind}</span>
            </div>
            <div className="info-text">{build.tagline}</div>
          </div>
        ) : (
          <div className="info-main info-text">Pick a tower, then tap a tile next to the path.</div>
        )}
      </div>

      <div className="dock-builds" role="toolbar" aria-label="Build towers">
        {TOWER_ORDER.map((type, i) => {
          const def = TOWERS[type];
          const cost = def.levels[0].cost;
          const active = !sel && hud.buildType === type;
          return (
            <button
              key={type}
              type="button"
              className={cn('build-btn', active && 'is-active', hud.gold < cost && 'is-poor')}
              style={{ '--tc': def.color } as CSSProperties}
              onClick={() => onPick(type)}
              aria-pressed={active}
              aria-label={`${def.name}, $${cost}`}
            >
              <span className="build-key">{i + 1}</span>
              <TowerIcon type={type} size={32} plate={plate} />
              <span className="build-name">{def.short}</span>
              <span className="build-cost">${cost}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
}
