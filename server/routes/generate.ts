import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const SPRITES_DIR = path.resolve(__dirname, '..', '..', 'public', 'assets', 'sprites');

// Prompt template enforces isometric consistency
const PROMPT_PREFIX = 'Isometric 2:1 dimetric projection, viewed from above-right, top-left lighting, carnival fairground style, transparent background, clean edges, vibrant colors';
const PROMPT_SUFFIX = 'single isolated object, no text, no watermark, game asset sprite';

// Target sprite sizes derived from actual isometric screen footprint.
// toIso formula: screen_x = (x - y), screen_y = (x + y) * 0.5
// A 50x50 logical item → diamond 100px wide, 50px tall + z-height for blocks.
// Food stall (z=20): ~100x70px. Spectacular (z=80): ~200x180px.
// We add padding so sprites have room for visual detail above the base.
// For asymmetric footprints the wider axis drives the sprite size.
const SPRITE_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1x1': { width: 100, height: 100 },   // stalls, bathrooms, kiddie rides
  '1x2': { width: 120, height: 140 },   // tall narrow structures
  '2x1': { width: 140, height: 120 },   // wide narrow structures
  '2x2': { width: 150, height: 150 },   // major attractions
  '2x3': { width: 170, height: 190 },   // large rectangular
  '3x2': { width: 190, height: 170 },   // wide rectangular
  '3x3': { width: 200, height: 200 },   // spectacular rides
  '3x4': { width: 220, height: 250 },   // very large rectangular
  '4x3': { width: 250, height: 220 },   // very wide rectangular
  '4x4': { width: 260, height: 260 },   // massive structures
};

/** Compute sprite size for any grid footprint, using the map for known sizes
 *  or interpolating for unlisted combinations. */
function getSpriteSize(gridW: number, gridH: number): { width: number; height: number } {
  const key = `${gridW}x${gridH}`;
  if (SPRITE_SIZE_MAP[key]) return SPRITE_SIZE_MAP[key];
  // Fallback: scale linearly from the 1x1 base (100px per grid unit, diminishing)
  const maxDim = Math.max(gridW, gridH);
  const base = 100;
  const size = base + (maxDim - 1) * 50;
  const w = Math.round(size * (gridW / maxDim));
  const h = Math.round(size * (gridH / maxDim));
  return { width: Math.max(w, base), height: Math.max(h, base) };
}

const REMBG_URL = process.env.REMBG_URL || 'http://rembg:5000';

/** Remove background via the rembg service. Returns a PNG with alpha channel. */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  console.log(`Calling rembg at ${REMBG_URL}/api/remove (${imageBuffer.length} bytes)...`);
  try {
    const response = await fetch(`${REMBG_URL}/api/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`rembg returned ${response.status}: ${errText}, skipping background removal`);
      return imageBuffer;
    }

    const arrayBuffer = await response.arrayBuffer();
    const result = Buffer.from(arrayBuffer);
    console.log(`rembg success: ${imageBuffer.length} -> ${result.length} bytes`);
    return result;
  } catch (err) {
    console.warn('rembg service unavailable, skipping background removal:', (err as Error).message);
    return imageBuffer;
  }
}

router.post('/', async (req, res) => {
  const { description, category, assetId, gridW = 1, gridH = 1 } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'description is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const fullPrompt = `${PROMPT_PREFIX}, ${description}, ${PROMPT_SUFFIX}`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      return res.status(502).json({ error: 'No images generated' });
    }

    const imageData = response.generatedImages[0].image?.imageBytes;
    if (!imageData) {
      return res.status(502).json({ error: 'No image data in response' });
    }

    let buffer = Buffer.from(imageData, 'base64');

    // Step 1: Remove background via rembg
    buffer = await removeBackground(buffer);

    // Step 2: Resize to target sprite dimensions based on grid footprint
    const targetSize = getSpriteSize(gridW, gridH);

    buffer = await sharp(buffer)
      .resize(targetSize.width, targetSize.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Save to sprites directory
    const categoryDir = path.join(SPRITES_DIR, category || 'uncategorized');
    fs.mkdirSync(categoryDir, { recursive: true });

    const filename = `${assetId || 'generated_' + Date.now()}.png`;
    const filePath = path.join(categoryDir, filename);
    fs.writeFileSync(filePath, buffer);

    const relativePath = `assets/sprites/${category || 'uncategorized'}/${filename}`;

    res.json({
      prompt: fullPrompt,
      imagePath: relativePath,
      model: 'imagen-4.0-generate-001',
      size: targetSize,
    });
  } catch (err: any) {
    console.error('Generation error:', err);
    res.status(502).json({ error: err.message || 'Generation failed' });
  }
});

export default router;
