import express from 'express';
import { aiService } from '../services/aiService.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper to get consistent paths
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const CHARACTERS_DIR = path.join(UPLOADS_DIR, 'characters');
const TEMP_DIR = path.join(UPLOADS_DIR, 'temp');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(CHARACTERS_DIR)) fs.mkdirSync(CHARACTERS_DIR);
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

/**
 * POST /api/characters/generate
 * Generates an image but does not save it permanently.
 */
router.post('/generate', async (req, res) => {
    try {
        const { characterName, characterPrompt, style } = req.body;

        if (!characterPrompt) {
            return res.status(400).json({ error: "Missing characterPrompt" });
        }

        // Generate image buffer
        const imageBuffer = await aiService.generateCharacterImage(characterPrompt, style);

        // Save to temp file
        const tempFileName = `${Date.now()}_${uuidv4()}.png`;
        const tempFilePath = path.join(TEMP_DIR, tempFileName);
        fs.writeFileSync(tempFilePath, imageBuffer);

        // Return URL accessible via static serve
        // Note: We need to make sure index.js serves '/uploads'
        const tempImageUrl = `/uploads/temp/${tempFileName}`;

        res.json({ tempImageUrl });
    } catch (error) {
        console.error("Generate error:", error);
        res.status(500).json({ error: "Failed to generate character", details: error.message });
    }
});

/**
 * POST /api/characters/save
 * Moves temp image to permanent storage and saves metadata.
 */
router.post('/save', async (req, res) => {
    try {
        // userId is assumed valid/present per requirements
        const userId = "123"; // TODO: Get from auth middleware if added later
        const { characterName, characterPrompt, imageUrl } = req.body;

        if (!imageUrl || !characterName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Extract filename from URL
        const tempFileName = path.basename(imageUrl);
        const tempFilePath = path.join(TEMP_DIR, tempFileName);

        if (!fs.existsSync(tempFilePath)) {
            return res.status(404).json({ error: "Image expired or not found" });
        }

        // Prepare destination
        const userDir = path.join(CHARACTERS_DIR, userId);
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

        const characterId = uuidv4();
        const newFileName = `${characterId}.png`;
        const newFilePath = path.join(userDir, newFileName);

        // Move file
        fs.renameSync(tempFilePath, newFilePath);

        // Save Metadata (mock database: just a json file in the user dir or return it)
        // Requirement says: Save metadata. We'll store a JSON file per character or one index file.
        // For simplicity and file system storage: saving a sidecar JSON.
        const characterData = {
            id: characterId,
            name: characterName,
            prompt: characterPrompt,
            imageUrl: `/uploads/characters/${userId}/${newFileName}`,
            createdAt: new Date().toISOString()
        };

        const metadataPath = path.join(userDir, `${characterId}.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(characterData, null, 2));

        res.json({ character: characterData });

    } catch (error) {
        console.error("Save error:", error);
        res.status(500).json({ error: "Failed to save character" });
    }
});

/**
 * GET /api/characters
 * Returns list of saved characters for the user.
 */
router.get('/', async (req, res) => {
    try {
        const userId = "123";
        const userDir = path.join(CHARACTERS_DIR, userId);

        if (!fs.existsSync(userDir)) {
            return res.json({ characters: [] });
        }

        // Read all JSON files in user dir
        const files = fs.readdirSync(userDir);
        const characters = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const content = fs.readFileSync(path.join(userDir, file), 'utf-8');
                return JSON.parse(content);
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ characters });
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Failed to fetch characters" });
    }
});

export default router;
