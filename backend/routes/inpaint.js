import express from 'express';
import { aiService } from '../services/aiService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../public/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

router.post('/', async (req, res) => {
    try {
        const { baseImage, mask, prompt, style } = req.body;

        if (!baseImage || !mask || !prompt) {
            return res.status(400).json({ error: 'Missing required fields: baseImage, mask, prompt' });
        }

        console.log('[Inpaint API] Request received');

        // Generate image buffer
        const imageBuffer = await aiService.generateInpainting(baseImage, mask, prompt, style);

        // Save to temp file
        const fileName = `inpaint_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);

        fs.writeFileSync(filePath, imageBuffer);

        // Return URL
        const imageUrl = `/temp/${fileName}`;
        console.log(`[Inpaint API] Image saved to ${imageUrl}`);

        res.json({ success: true, imageUrl });

    } catch (error) {
        console.error('[Inpaint API] Error:', error);
        res.status(500).json({ error: error.message || 'Inpainting failed' });
    }
});

export default router;
