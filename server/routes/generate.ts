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

// Target sprite sizes based on grid footprint and tile dimensions.
// TILE_WIDTH=40, TILE_HEIGHT=20, so a 1x1 item (50x50 logical units) maps to ~80px wide sprite.
// We use 2x multiplier for visual quality.
const SPRITE_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1x1': { width: 160, height: 160 },
  '2x2': { width: 240, height: 240 },
  '3x3': { width: 320, height: 320 },
};

const REMBG_URL = process.env.REMBG_URL || 'http://rembg:5000';

/** Remove background via the rembg service. Returns the processed PNG buffer. */
async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const response = await fetch(`${REMBG_URL}/api/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: imageBuffer,
    });

    if (!response.ok) {
      console.warn(`rembg returned ${response.status}, skipping background removal`);
      return imageBuffer;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
    const sizeKey = `${gridW}x${gridH}`;
    const targetSize = SPRITE_SIZE_MAP[sizeKey] || SPRITE_SIZE_MAP['1x1'];

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
