import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { HfInference } from '@huggingface/inference';

// Load environment variables from .env file
config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from uploads directory
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
import characterRoutes from './routes/characters.js';
app.use('/api/characters', characterRoutes);

// Constants
const PORT = process.env.PORT || 5050;
const MODEL = "Tongyi-MAI/Z-Image-Turbo";

// Initialize Hugging Face client
const HF_TOKEN = process.env.HF_TOKEN;
const hf = new HfInference(HF_TOKEN);

console.log("Image Provider: Hugging Face Inference API");
console.log("Model:", MODEL);
console.log("HF Token Loaded:", HF_TOKEN ? "YES (" + HF_TOKEN.slice(0, 5) + "...)" : "NO");

/**
 * Generate Image Route (Legacy/Direct)
 * ... (keeping this for backward compatibility if needed, or we can deprecate)
 */
app.post('/api/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      width = 1024,
      height = 1024
    } = req.body;

    // Validate required prompt
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    console.log(`Generating image for prompt: "${prompt}"`);

    // Call Hugging Face API
    const imageBlob = await hf.textToImage({
      model: MODEL,
      inputs: prompt,
      parameters: {
        width: width,
        height: height,
      }
    });

    // Convert Blob to Buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to base64 data URL
    const base64Image = buffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Return the generated image as data URL
    res.json({ imageUrl });

  } catch (error) {
    // Log error for debugging
    console.error('Image generation error:', error);

    // Return error response with details
    res.status(500).json({
      error: 'Generation failed',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});