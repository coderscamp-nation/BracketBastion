import { useEffect, useRef } from 'react';
import type { TowerType } from '../game/config';
import { drawTowerGlyph } from '../game/render';

/** Renders the same schematic glyph the board uses, so UI and playfield always match. */
export default function TowerIcon({ type, size = 36, level = 0, plate }: { type: TowerType; size?: number; level?: number; plate?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      drawTowerGlyph(ctx, type, size / 2, size / 2, size * 1.14, level, 0, -Math.PI / 4, 0, 1, plate);
    };
    paint();
    // repaint once web fonts land so the "401k" label uses the right face
    void document.fonts?.ready.then(paint);
    return () => {
      alive = false;
    };
  }, [type, size, level, plate]);

  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size, flex: 'none' }} />;
}
