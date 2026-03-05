import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import assetsRouter from './routes/assets';
import generateRouter from './routes/generate';
import exportRouter from './routes/export';

const app = express();
const PORT = process.env.EDITOR_PORT || 3001;

app.use(express.json({ limit: '50mb' }));

// Serve sprite images from public/assets
app.use('/assets', express.static(path.resolve(__dirname, '..', 'public', 'assets')));

// API routes
app.use('/api/assets', assetsRouter);
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);

app.listen(PORT, () => {
  console.log(`Asset engine server running on http://localhost:${PORT}`);
});
