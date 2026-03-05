import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const router = Router();

const SPRITES_DIR = path.resolve(__dirname, '..', '..', 'public', 'assets', 'sprites');

// Prompt template enforces isometric consistency
const PROMPT_PREFIX = 'Isometric 2:1 dimetric projection, viewed from above-right, top-left lighting, carnival fairground style, transparent background, clean edges, vibrant colors';
const PROMPT_SUFFIX = 'single isolated object, no text, no watermark, game asset sprite';

router.post('/', async (req, res) => {
  const { description, category, assetId } = req.body;

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
      model: 'imagen-3.0-generate-002',
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

    // Save to sprites directory
    const categoryDir = path.join(SPRITES_DIR, category || 'uncategorized');
    fs.mkdirSync(categoryDir, { recursive: true });

    const filename = `${assetId || 'generated_' + Date.now()}.png`;
    const filePath = path.join(categoryDir, filename);
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(filePath, buffer);

    const relativePath = `assets/sprites/${category || 'uncategorized'}/${filename}`;

    res.json({
      prompt: fullPrompt,
      imagePath: relativePath,
      model: 'imagen-3.0-generate-002',
    });
  } catch (err: any) {
    console.error('Generation error:', err);
    res.status(502).json({ error: err.message || 'Generation failed' });
  }
});

export default router;
