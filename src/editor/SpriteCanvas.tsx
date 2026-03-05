import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AssetRecord, assetsApi } from './api';

/**
 * Isometric grid constants — mirrors engine.ts values.
 * Used to overlay the tile grid on the sprite for anchor alignment.
 */
const TILE_W = 40;
const TILE_H = 20;

interface Props {
  asset: AssetRecord | null;
  onAnchorSet: (asset: AssetRecord) => void;
}

export function SpriteCanvas({ asset, onAnchorSet }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load image when asset changes
  useEffect(() => {
    if (!asset?.image_path) {
      setImage(null);
      setAnchor(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage(img);
      // Restore saved anchor if present
      if (asset.anchor_x || asset.anchor_y) {
        setAnchor({ x: asset.anchor_x, y: asset.anchor_y });
      } else {
        // Default anchor: bottom-center of image
        setAnchor({ x: Math.round(img.width / 2), y: img.height });
      }
    };
    img.onerror = () => setImage(null);
    img.src = '/' + asset.image_path;
  }, [asset?.image_path, asset?.anchor_x, asset?.anchor_y]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Checkerboard transparency background
    const checkSize = 8;
    for (let y = 0; y < ch; y += checkSize) {
      for (let x = 0; x < cw; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#2a2a2a' : '#333';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    if (!image) {
      ctx.fillStyle = '#555';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No image loaded', cw / 2, ch / 2);
      ctx.fillText('Generate an asset or select one from the browser', cw / 2, ch / 2 + 20);
      return;
    }

    // Center image in canvas
    const ox = Math.round((cw - image.width) / 2);
    const oy = Math.round((ch - image.height) / 2);

    ctx.drawImage(image, ox, oy);

    // Draw isometric grid overlay
    if (showGrid && anchor) {
      const gridW = (asset?.grid_w ?? 1);
      const gridH = (asset?.grid_h ?? 1);
      const anchorScreenX = ox + anchor.x;
      const anchorScreenY = oy + anchor.y;

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
      ctx.lineWidth = 1;

      // Draw iso diamond for each grid cell
      for (let gx = 0; gx < gridW; gx++) {
        for (let gy = 0; gy < gridH; gy++) {
          const cx = anchorScreenX + (gx - gy) * TILE_W;
          const cy = anchorScreenY + (gx + gy) * TILE_H * -1; // up from anchor

          ctx.beginPath();
          ctx.moveTo(cx, cy - TILE_H);       // top
          ctx.lineTo(cx + TILE_W, cy);        // right
          ctx.lineTo(cx, cy + TILE_H);        // bottom
          ctx.lineTo(cx - TILE_W, cy);        // left
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // Draw anchor point
    if (anchor) {
      const ax = ox + anchor.x;
      const ay = oy + anchor.y;

      // Crosshair
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax - 10, ay);
      ctx.lineTo(ax + 10, ay);
      ctx.moveTo(ax, ay - 10);
      ctx.lineTo(ax, ay + 10);
      ctx.stroke();

      // Circle
      ctx.beginPath();
      ctx.arc(ax, ay, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Label
      ctx.fillStyle = '#ef4444';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`anchor (${anchor.x}, ${anchor.y})`, ax + 8, ay - 4);
    }
  }, [image, anchor, showGrid, asset?.grid_w, asset?.grid_h]);

  // Handle click to set anchor
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const ox = Math.round((canvasRef.current.width - image.width) / 2);
    const oy = Math.round((canvasRef.current.height - image.height) / 2);

    // Convert to image-local coordinates
    const imgX = Math.round(clickX - ox);
    const imgY = Math.round(clickY - oy);

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(image.width, imgX));
    const clampedY = Math.max(0, Math.min(image.height, imgY));

    setAnchor({ x: clampedX, y: clampedY });
  }, [image]);

  // Save anchor to backend
  const handleSaveAnchor = useCallback(async () => {
    if (!asset || !anchor) return;
    setSaving(true);
    try {
      const updated = await assetsApi.setAnchor(asset.id, anchor.x, anchor.y);
      onAnchorSet(updated);
    } catch (err: any) {
      console.error('Failed to save anchor:', err);
    } finally {
      setSaving(false);
    }
  }, [asset, anchor, onAnchorSet]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Sprite Canvas</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={e => setShowGrid(e.target.checked)}
              className="rounded"
            />
            Show grid
          </label>
          {anchor && asset && (
            <button
              onClick={handleSaveAnchor}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-600 text-white text-xs font-bold rounded px-3 py-1 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Anchor'}
            </button>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        onClick={handleClick}
        className="rounded-lg border border-zinc-700 cursor-crosshair w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      <p className="text-xs text-zinc-500">Click to set the anchor point (the base of the sprite that aligns with the isometric grid).</p>
    </div>
  );
}
